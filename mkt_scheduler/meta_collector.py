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
    Saves account-level summary to daily_media_summary and ad-level performance
    to keyword_performance under media='META_ADS'.
    """
    logger.info(f"[Meta Collector] Starting collection for {target_date}...")

    if not META_ACCESS_TOKEN or not META_AD_ACCOUNT_ID:
        err_msg = "Meta credentials (access_token or ad_account_id) missing."
        logger.error(f"[Meta Collector] {err_msg}")
        log_event("META_COLLECTOR", "ERROR", err_msg)
        return {"success": False, "error": err_msg}

    base_url = f"https://graph.facebook.com/{META_API_VERSION}/{META_AD_ACCOUNT_ID}/insights"
    time_range_json = json.dumps({"since": target_date, "until": target_date})

    # 1. Account-level summary insights
    try:
        summary_params = {
            "access_token": META_ACCESS_TOKEN,
            "time_range": time_range_json,
            "fields": "spend,impressions,clicks,cpc,ctr"
        }
        res = requests.get(base_url, params=summary_params, timeout=15)
        if res.status_code != 200:
            err = f"Meta API summary query failed ({res.status_code}): {res.text}"
            logger.error(f"[Meta Collector] {err}")
            log_event("META_COLLECTOR", "ERROR", err)
            return {"success": False, "error": err}

        data = res.json().get("data", [])
        if not data:
            logger.info(f"[Meta Collector] No Meta Ads spend recorded on {target_date}.")
            # Save 0 record so summary reflects no spend
            rec = [{
                "date": target_date,
                "media": "META_ADS",
                "spend": 0,
                "impressions": 0,
                "clicks": 0,
                "cpc": 0.0,
                "ctr": 0.0
            }]
            save_daily_media_records(rec)
            return {"success": True, "spend": 0, "clicks": 0, "impressions": 0}

        row = data[0]
        spend = round(float(row.get("spend", 0)))
        impressions = int(row.get("impressions", 0))
        clicks = int(row.get("clicks", 0))
        cpc = float(row.get("cpc", 0) or (round(spend / clicks, 1) if clicks > 0 else 0.0))
        ctr = float(row.get("ctr", 0) or (round((clicks / impressions) * 100, 2) if impressions > 0 else 0.0))

        rec = [{
            "date": target_date,
            "media": "META_ADS",
            "spend": spend,
            "impressions": impressions,
            "clicks": clicks,
            "cpc": cpc,
            "ctr": ctr
        }]
        save_daily_media_records(rec)
        logger.info(f"[Meta Collector] Saved META_ADS summary: ₩{spend:,} / {clicks} clicks / {impressions:,} impr / CPC ₩{round(cpc):,}")

    except Exception as e:
        err = f"Exception fetching Meta summary: {e}"
        logger.error(f"[Meta Collector] {err}")
        log_event("META_COLLECTOR", "ERROR", err)
        return {"success": False, "error": err}

    # 2. Ad-level breakdown insights
    try:
        ad_params = {
            "access_token": META_ACCESS_TOKEN,
            "time_range": time_range_json,
            "level": "ad",
            "fields": "ad_name,campaign_name,spend,impressions,clicks,cpc,ctr"
        }
        res_ad = requests.get(base_url, params=ad_params, timeout=20)
        if res_ad.status_code == 200:
            ad_data = res_ad.json().get("data", [])
            ad_records = []
            for ad in ad_data:
                ad_name = ad.get("ad_name", "알 수 없는 소재")
                camp_name = ad.get("campaign_name", "")
                ad_spend = round(float(ad.get("spend", 0)))
                ad_clicks = int(ad.get("clicks", 0))
                ad_impr = int(ad.get("impressions", 0))
                ad_cpc = float(ad.get("cpc", 0) or (round(ad_spend / ad_clicks, 1) if ad_clicks > 0 else 0.0))
                ad_ctr = float(ad.get("ctr", 0) or (round((ad_clicks / ad_impr) * 100, 2) if ad_impr > 0 else 0.0))

                ad_records.append({
                    "date": target_date,
                    "keyword": ad_name,
                    "media": "META_ADS",
                    "campaign": camp_name,
                    "adgroup": "",
                    "impressions": ad_impr,
                    "clicks": ad_clicks,
                    "spend": ad_spend,
                    "cpc": ad_cpc,
                    "ctr": ad_ctr
                })

            if ad_records:
                save_keyword_records(ad_records)
                logger.info(f"[Meta Collector] Successfully saved {len(ad_records)} ad-level records for {target_date}")
        else:
            logger.warning(f"[Meta Collector] Failed to fetch ad-level breakdown: {res_ad.text}")

    except Exception as e:
        logger.warning(f"[Meta Collector] Exception fetching ad breakdown: {e}")

    log_event("META_COLLECTOR", "SUCCESS", f"Collected ₩{spend:,} ({clicks} clicks)")
    return {
        "success": True,
        "spend": spend,
        "clicks": clicks,
        "impressions": impressions
    }
