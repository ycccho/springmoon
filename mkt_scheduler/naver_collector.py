import time
import hmac
import hashlib
import base64
import json
import logging
from datetime import datetime, timedelta
import requests

from .config import (
    NAVER_BASE_URL,
    NAVER_API_KEY,
    NAVER_SECRET_KEY,
    NAVER_CUSTOMER_ID
)
from .db_manager import save_daily_media_records, save_keyword_records, log_event

logger = logging.getLogger(__name__)

def get_auth_headers(method: str, path: str) -> dict:
    timestamp = str(round(time.time() * 1000))
    message = f"{timestamp}.{method}.{path}"
    hash_obj = hmac.new(
        NAVER_SECRET_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    )
    signature = base64.b64encode(hash_obj.digest()).decode("utf-8")

    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Timestamp": timestamp,
        "X-API-KEY": NAVER_API_KEY,
        "X-CUSTOMER": str(NAVER_CUSTOMER_ID),
        "X-Signature": signature
    }

def fetch_campaigns() -> list:
    path = "/ncc/campaigns"
    headers = get_auth_headers("GET", path)
    try:
        res = requests.get(f"{NAVER_BASE_URL}{path}", headers=headers, timeout=15)
        if res.status_code == 200:
            return res.json()
        logger.error(f"Failed to fetch campaigns: {res.status_code} {res.text}")
    except Exception as e:
        logger.error(f"Exception fetching campaigns: {e}")
    return []

def fetch_batch_stats(entity_ids: list, target_date: str) -> dict:
    """
    Fetches performance metrics for multiple entity IDs in batch chunks (up to 100 IDs per call).
    Returns dict mapping entity_id -> {clicks, impressions, spend, cpc, ctr}
    """
    if not entity_ids:
        return {}

    results = {}
    chunk_size = 100

    for i in range(0, len(entity_ids), chunk_size):
        chunk = entity_ids[i:i + chunk_size]
        params = {
            "ids": ",".join(chunk),
            "fields": json.dumps(["clkCnt", "impCnt", "salesAmt", "ctr", "cpc"]),
            "timeRange": json.dumps({"since": target_date, "until": target_date})
        }
        headers = get_auth_headers("GET", "/stats")
        try:
            res = requests.get(f"{NAVER_BASE_URL}/stats", headers=headers, params=params, timeout=15)
            if res.status_code == 200:
                data = res.json().get("data", [])
                for item in data:
                    item_id = item.get("id")
                    if item_id:
                        results[item_id] = {
                            "clicks": int(item.get("clkCnt") or 0),
                            "impressions": int(item.get("impCnt") or 0),
                            "spend": int(item.get("salesAmt") or 0),
                            "cpc": float(item.get("cpc") or 0.0),
                            "ctr": float(item.get("ctr") or 0.0)
                        }
            else:
                logger.error(f"Error in batch stats: {res.status_code} {res.text}")
        except Exception as e:
            logger.error(f"Exception in fetch_batch_stats: {e}")

    return results

def fetch_adgroups(campaign_id: str) -> list:
    headers = get_auth_headers("GET", "/ncc/adgroups")
    try:
        res = requests.get(
            f"{NAVER_BASE_URL}/ncc/adgroups",
            headers=headers,
            params={"nccCampaignId": campaign_id},
            timeout=15
        )
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        logger.error(f"Error fetching adgroups for {campaign_id}: {e}")
    return []

def fetch_keywords(adgroup_id: str) -> list:
    headers = get_auth_headers("GET", "/ncc/keywords")
    try:
        res = requests.get(
            f"{NAVER_BASE_URL}/ncc/keywords",
            headers=headers,
            params={"nccAdgroupId": adgroup_id},
            timeout=15
        )
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        logger.error(f"Error fetching keywords for {adgroup_id}: {e}")
    return []

def fetch_expanded_keywords(target_date: str) -> list:
    """
    Requests and downloads EXPKEYWORD (키워드 확장/검색어 광고효과 보고서) from Naver Search Ads stat-reports API.
    Provides actual user search terms, impressions, clicks, and spend for PowerLink.
    """
    stat_dt = target_date.replace("-", "")
    path = "/stat-reports"
    payload = {
        "reportTp": "EXPKEYWORD",
        "statDt": stat_dt
    }
    headers = get_auth_headers("POST", path)
    try:
        res = requests.post(f"{NAVER_BASE_URL}{path}", json=payload, headers=headers, timeout=15)
        if res.status_code != 200:
            logger.warning(f"[Naver Collector] Failed to request EXPKEYWORD report: {res.status_code} {res.text}")
            return []

        job_id = res.json().get("reportJobId")
        if not job_id:
            return []

        # Poll for completion (up to 20 seconds)
        download_url = None
        for _ in range(10):
            time.sleep(2)
            h_get = get_auth_headers("GET", f"/stat-reports/{job_id}")
            r_get = requests.get(f"{NAVER_BASE_URL}/stat-reports/{job_id}", headers=h_get, timeout=10)
            if r_get.status_code == 200:
                s_data = r_get.json()
                if s_data.get("status") == "BUILT":
                    download_url = s_data.get("downloadUrl")
                    break
                elif s_data.get("status") in ("ERROR", "NONE"):
                    logger.warning(f"[Naver Collector] EXPKEYWORD job status: {s_data.get('status')}")
                    break

        if not download_url:
            return []

        h_dl = get_auth_headers("GET", "/report-download")
        r_dl = requests.get(download_url, headers=h_dl, timeout=30)
        if r_dl.status_code != 200:
            logger.warning(f"[Naver Collector] Failed to download report: {r_dl.status_code}")
            return []

        results = []
        for line in r_dl.text.strip().split("\n"):
            parts = line.split("\t")
            if len(parts) >= 11:
                clicks = int(parts[9]) if parts[9].isdigit() else 0
                spend = int(parts[10]) if parts[10].isdigit() else 0
                impr = int(parts[7]) if parts[7].isdigit() else 0
                if clicks > 0 or spend > 0:
                    results.append({
                        "date": target_date,
                        "campaign_id": parts[2],
                        "adgroup_id": parts[3],
                        "keyword": parts[4],
                        "impressions": impr,
                        "clicks": clicks,
                        "spend": spend,
                        "cpc": round(spend / clicks, 1) if clicks > 0 else 0,
                        "ctr": round((clicks / impr) * 100, 2) if impr > 0 else 0.0
                    })
        return results
    except Exception as e:
        logger.error(f"[Naver Collector] Exception in fetch_expanded_keywords: {e}")
        return []

def collect_naver_stats(target_date: str = None) -> dict:

    """
    High-performance, batch-optimized collector for Naver Search Ads.
    target_date: 'YYYY-MM-DD'. If None, defaults to yesterday.
    """
    if not target_date:
        target_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    logger.info(f"[Naver Collector] Starting collection for {target_date}...")

    campaigns = fetch_campaigns()
    if not campaigns:
        log_event("NAVER_COLLECT", "WARNING", f"No campaigns retrieved for {target_date}")
        return {"success": False, "error": "No campaigns found"}

    camp_map = {c["nccCampaignId"]: c for c in campaigns}
    camp_ids = list(camp_map.keys())

    # Step 1: Batch fetch campaign performance
    camp_stats = fetch_batch_stats(camp_ids, target_date)

    powerlink_stats = {"spend": 0, "impressions": 0, "clicks": 0}
    powercontents_stats = {"spend": 0, "impressions": 0, "clicks": 0}
    place_stats = {"spend": 0, "impressions": 0, "clicks": 0}

    keyword_records = []

    for cid, camp in camp_map.items():
        st = camp_stats.get(cid, {"clicks": 0, "impressions": 0, "spend": 0, "cpc": 0.0, "ctr": 0.0})
        camp_type = camp.get("campaignTp", "")
        camp_name = camp.get("name", "")

        spend = st["spend"]
        impr = st["impressions"]
        clicks = st["clicks"]

        if camp_type == "WEB_SITE":
            powerlink_stats["spend"] += spend
            powerlink_stats["impressions"] += impr
            powerlink_stats["clicks"] += clicks
            media_label = "네이버 파워링크"
        elif camp_type == "POWER_CONTENTS":
            powercontents_stats["spend"] += spend
            powercontents_stats["impressions"] += impr
            powercontents_stats["clicks"] += clicks
            media_label = "네이버 파워컨텐츠"
        elif camp_type == "PLACE":
            place_stats["spend"] += spend
            place_stats["impressions"] += impr
            place_stats["clicks"] += clicks
            media_label = "네이버 플레이스"
        else:
            media_label = "네이버 기타"

        # Step 2: For Place Ads, record at campaign/group level
        if camp_type == "PLACE" and (spend > 0 or clicks > 0 or impr > 0):
            keyword_records.append({
                "date": target_date,
                "keyword": f"플레이스 광고 ({camp_name})",
                "media": "네이버 플레이스",
                "campaign": camp_name,
                "adgroup": "스마트플레이스 연동",
                "impressions": impr,
                "clicks": clicks,
                "spend": spend,
                "cpc": round(spend / clicks, 1) if clicks > 0 else 0,
                "ctr": round((clicks / impr) * 100, 2) if impr > 0 else 0
            })

        # Step 3: For PowerLink (WEB_SITE) or PowerContents, drill into queries / keywords
        elif camp_type in ("WEB_SITE", "POWER_CONTENTS") and clicks > 0:
            if camp_type == "WEB_SITE":
                exp_kws = fetch_expanded_keywords(target_date)
                if exp_kws:
                    adgroups = fetch_adgroups(cid)
                    ag_id_to_name = {ag["nccAdgroupId"]: ag["name"] for ag in adgroups} if adgroups else {}
                    for ek in exp_kws:
                        ag_name = ag_id_to_name.get(ek["adgroup_id"], "파워링크")
                        keyword_records.append({
                            "date": target_date,
                            "keyword": ek["keyword"],
                            "media": media_label,
                            "campaign": camp_name,
                            "adgroup": ag_name,
                            "impressions": ek["impressions"],
                            "clicks": ek["clicks"],
                            "spend": ek["spend"],
                            "cpc": ek["cpc"],
                            "ctr": ek["ctr"]
                        })
                    logger.info(f"[Naver Collector] Successfully recorded {len(exp_kws)} search queries from EXPKEYWORD report.")
                    continue

            # Fallback for WEB_SITE if EXPKEYWORD empty, or standard drill-down for POWER_CONTENTS
            adgroups = fetch_adgroups(cid)
            if not adgroups:
                continue



            ag_map = {ag["nccAdgroupId"]: ag for ag in adgroups}
            ag_stats = fetch_batch_stats(list(ag_map.keys()), target_date)

            for ag_id, ag in ag_map.items():
                ag_st = ag_stats.get(ag_id)
                if not ag_st or ag_st["clicks"] == 0:
                    continue

                ag_name = ag.get("name", "")
                keywords = fetch_keywords(ag_id)
                if not keywords:
                    continue

                kw_map = {k["nccKeywordId"]: k for k in keywords}
                kw_stats = fetch_batch_stats(list(kw_map.keys()), target_date)

                ag_added_clicks = 0
                ag_added_spend = 0
                for kw_id, kw in kw_map.items():
                    kst = kw_stats.get(kw_id)
                    if kst and (kst["clicks"] > 0 or kst["spend"] > 0):
                        keyword_records.append({
                            "date": target_date,
                            "keyword": kw.get("keyword", ""),
                            "media": media_label,
                            "campaign": camp_name,
                            "adgroup": ag_name,
                            "impressions": kst["impressions"],
                            "clicks": kst["clicks"],
                            "spend": kst["spend"],
                            "cpc": kst["cpc"],
                            "ctr": kst["ctr"]
                        })
                        ag_added_clicks += kst["clicks"]
                        ag_added_spend += kst["spend"]

                # If adgroup had clicks not captured at individual keyword level (extension assets, etc.)
                if ag_st["clicks"] > ag_added_clicks:
                    diff_clicks = ag_st["clicks"] - ag_added_clicks
                    diff_spend = max(0, ag_st["spend"] - ag_added_spend)
                    clean_ag_name = ag_name.split("-")[0].strip()
                    keyword_records.append({
                        "date": target_date,
                        "keyword": f"{clean_ag_name}(확장소재)",
                        "media": media_label,
                        "campaign": camp_name,
                        "adgroup": ag_name,
                        "impressions": ag_st["impressions"],
                        "clicks": diff_clicks,
                        "spend": diff_spend,
                        "cpc": round(diff_spend / diff_clicks) if diff_clicks > 0 else 0,
                        "ctr": round((diff_clicks / ag_st["impressions"]) * 100, 2) if ag_st["impressions"] > 0 else 0
                    })


    # Save to SQLite
    media_records = [
        {
            "date": target_date,
            "media": "NAVER_POWERLINK",
            "spend": powerlink_stats["spend"],
            "impressions": powerlink_stats["impressions"],
            "clicks": powerlink_stats["clicks"]
        },
        {
            "date": target_date,
            "media": "NAVER_POWERCONTENTS",
            "spend": powercontents_stats["spend"],
            "impressions": powercontents_stats["impressions"],
            "clicks": powercontents_stats["clicks"]
        },
        {
            "date": target_date,
            "media": "NAVER_PLACE",
            "spend": place_stats["spend"],
            "impressions": place_stats["impressions"],
            "clicks": place_stats["clicks"]
        }
    ]

    save_daily_media_records(media_records)
    if keyword_records:
        save_keyword_records(keyword_records)

    total_naver_spend = powerlink_stats["spend"] + powercontents_stats["spend"] + place_stats["spend"]
    total_naver_clicks = powerlink_stats["clicks"] + powercontents_stats["clicks"] + place_stats["clicks"]

    log_event(
        "NAVER_COLLECT",
        "SUCCESS",
        f"Collected {target_date}: Spend ₩{total_naver_spend:,}, Clicks {total_naver_clicks:,}"
    )

    logger.info(f"[Naver Collector] Success. Spend: ₩{total_naver_spend:,}, Clicks: {total_naver_clicks}, Keywords: {len(keyword_records)}")

    return {
        "success": True,
        "date": target_date,
        "powerlink": powerlink_stats,
        "powercontents": powercontents_stats,
        "place": place_stats,
        "keywords_count": len(keyword_records)
    }

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import sys
    d = sys.argv[1] if len(sys.argv) > 1 else None
    res = collect_naver_stats(d)
    print("Result:", json.dumps(res, indent=2, ensure_ascii=False))
