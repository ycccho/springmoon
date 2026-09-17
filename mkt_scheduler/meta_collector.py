import json
import logging
import requests
from datetime import datetime
from pathlib import Path

from .config import (
    META_ACCESS_TOKEN,
    META_AD_ACCOUNT_ID,
    META_API_VERSION,
    CREDENTIALS_PATH
)
from .db_manager import save_daily_media_records, save_keyword_records, log_event

logger = logging.getLogger(__name__)

def collect_meta_stats(target_date: str) -> dict:
    """
    Collects Meta Ads (Instagram / Facebook) performance for target_date.
    Uses 'inline_link_clicks' (링크 클릭) as the standard click metric to match Meta Ads Manager.
    Dynamically queries all active ads so any newly added or renamed ads are automatically tracked.
    Saves account-level summary to daily_media_summary and ad-level performance
    to keyword_performance under media='META_ADS'.
    """
    logger.info(f"[Meta Collector] Starting collection for {target_date}...")

    if not META_ACCESS_TOKEN or not META_AD_ACCOUNT_ID:
        err_msg = "Meta credentials (access_token or ad_account_id) missing."
        logger.error(f"[Meta Collector] {err_msg}")
        log_event("META_COLLECTOR", "ERROR", err_msg)
        return {"success": False, "error": err_msg}

    time_range_json = json.dumps({"since": target_date, "until": target_date})

    # 1. Fetch live active ads from the ad account (dynamic naming & newly created ads)
    active_ads_map = {}
    try:
        ads_url = f"https://graph.facebook.com/{META_API_VERSION}/{META_AD_ACCOUNT_ID}/ads"
        ads_params = {
            "access_token": META_ACCESS_TOKEN,
            "effective_status": '["ACTIVE"]',
            "fields": "id,name,campaign_id,campaign{name},adset_id,adset{name},created_time",
            "limit": 100
        }
        res_ads = requests.get(ads_url, params=ads_params, timeout=20)
        if res_ads.status_code == 200:
            for ad in res_ads.json().get("data", []):
                active_ads_map[ad["id"]] = ad
            logger.info(f"[Meta Collector] Discovered {len(active_ads_map)} live active ads from Meta.")
        else:
            logger.warning(f"[Meta Collector] Could not list active ads ({res_ads.status_code}): {res_ads.text}")
    except Exception as e:
        logger.warning(f"[Meta Collector] Exception querying active ads: {e}")

    # 2. Account-level summary insights (using inline_link_clicks)
    insights_base_url = f"https://graph.facebook.com/{META_API_VERSION}/{META_AD_ACCOUNT_ID}/insights"
    spend = 0
    impressions = 0
    link_clicks = 0
    cpc = 0.0
    ctr = 0.0

    try:
        summary_params = {
            "access_token": META_ACCESS_TOKEN,
            "time_range": time_range_json,
            "fields": "spend,impressions,inline_link_clicks,cost_per_inline_link_click,ctr"
        }
        res = requests.get(insights_base_url, params=summary_params, timeout=15)
        if res.status_code != 200:
            err = f"Meta API summary query failed ({res.status_code}): {res.text}"
            logger.error(f"[Meta Collector] {err}")
            log_event("META_COLLECTOR", "ERROR", err)
            return {"success": False, "error": err}

        data = res.json().get("data", [])
        if data:
            row = data[0]
            spend = round(float(row.get("spend", 0)))
            impressions = int(row.get("impressions", 0))
            link_clicks = int(row.get("inline_link_clicks", 0))
            cpc = float(row.get("cost_per_inline_link_click", 0) or (round(spend / link_clicks, 1) if link_clicks > 0 else 0.0))
            ctr = float(round((link_clicks / impressions) * 100, 2) if impressions > 0 else 0.0)

        rec = [{
            "date": target_date,
            "media": "META_ADS",
            "spend": spend,
            "impressions": impressions,
            "clicks": link_clicks,
            "cpc": cpc,
            "ctr": ctr
        }]
        save_daily_media_records(rec)
        logger.info(f"[Meta Collector] Saved META_ADS summary: ₩{spend:,} / {link_clicks} link clicks / {impressions:,} impr / CPC ₩{round(cpc):,}")

    except Exception as e:
        err = f"Exception fetching Meta summary: {e}"
        logger.error(f"[Meta Collector] {err}")
        log_event("META_COLLECTOR", "ERROR", err)
        return {"success": False, "error": err}

    # 3. Ad-level breakdown insights
    try:
        ad_params = {
            "access_token": META_ACCESS_TOKEN,
            "time_range": time_range_json,
            "level": "ad",
            "fields": "ad_id,ad_name,campaign_name,adset_name,spend,impressions,inline_link_clicks,cost_per_inline_link_click"
        }
        res_ad = requests.get(insights_base_url, params=ad_params, timeout=20)
        ins_by_id = {}
        if res_ad.status_code == 200:
            for ad_ins in res_ad.json().get("data", []):
                ins_by_id[ad_ins["ad_id"]] = ad_ins
        else:
            logger.warning(f"[Meta Collector] Failed to fetch ad-level insights: {res_ad.text}")

        # Merge all active ads + any ad that had spend on target_date
        all_tracked_ids = set(active_ads_map.keys()) | set(ins_by_id.keys())
        ad_records = []

        for aid in all_tracked_ids:
            act_info = active_ads_map.get(aid, {})
            ins_info = ins_by_id.get(aid, {})

            ad_name = act_info.get("name") or ins_info.get("ad_name", "알 수 없는 광고")
            camp_name = act_info.get("campaign", {}).get("name") or ins_info.get("campaign_name", "")
            adset_name = act_info.get("adset", {}).get("name") or ins_info.get("adset_name", "")

            ad_spend = round(float(ins_info.get("spend", 0)))
            ad_clicks = int(ins_info.get("inline_link_clicks", 0))
            ad_impr = int(ins_info.get("impressions", 0))
            ad_cpc = float(ins_info.get("cost_per_inline_link_click", 0) or (round(ad_spend / ad_clicks, 1) if ad_clicks > 0 else 0.0))
            ad_ctr = float(round((ad_clicks / ad_impr) * 100, 2) if ad_impr > 0 else 0.0)

            ad_records.append({
                "date": target_date,
                "keyword": ad_name,
                "media": "META_ADS",
                "campaign": camp_name,
                "adgroup": adset_name,
                "impressions": ad_impr,
                "clicks": ad_clicks,
                "spend": ad_spend,
                "cpc": ad_cpc,
                "ctr": ad_ctr
            })

        if ad_records:
            save_keyword_records(ad_records)
            logger.info(f"[Meta Collector] Successfully saved {len(ad_records)} ads for {target_date} (Active & Insight merged)")

    except Exception as e:
        logger.warning(f"[Meta Collector] Exception processing ad breakdown: {e}")

    log_event("META_COLLECTOR", "SUCCESS", f"Collected ₩{spend:,} ({link_clicks} link clicks)")
    return {
        "success": True,
        "spend": spend,
        "clicks": link_clicks,
        "impressions": impressions
    }
