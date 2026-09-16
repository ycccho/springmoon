import os
import json
import logging
from datetime import datetime, timedelta
import requests

from .config import (
    GOOGLE_DEVELOPER_TOKEN,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CUSTOMER_ID,
    GOOGLE_API_VERSION,
    GOOGLE_TOKENS_PATH
)
from .db_manager import save_daily_media_records, save_keyword_records, log_event, get_connection

logger = logging.getLogger(__name__)

def load_google_tokens() -> dict:
    if not GOOGLE_TOKENS_PATH.exists():
        return {}
    try:
        with open(GOOGLE_TOKENS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading google tokens: {e}")
        return {}

def save_google_tokens(tokens: dict):
    try:
        with open(GOOGLE_TOKENS_PATH, "w", encoding="utf-8") as f:
            json.dump(tokens, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving google tokens: {e}")

def get_google_access_token() -> str:
    """
    Exchanges refresh token for a short-lived access token using Google OAuth2.
    """
    tokens = load_google_tokens()
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        logger.warning("No Google refresh token found. Please run get_google_token.py first.")
        return ""

    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }

    try:
        res = requests.post(token_url, data=payload, timeout=10)
        if res.status_code == 200:
            data = res.json()
            access_token = data.get("access_token")
            return access_token
        else:
            logger.error(f"Failed to refresh Google access token: {res.status_code} {res.text}")
            log_event("GOOGLE_AUTH", "ERROR", f"Token refresh failed: {res.text}")
    except Exception as e:
        logger.error(f"Exception refreshing Google access token: {e}")
    return ""

def query_google_ads(query: str, access_token: str) -> list:
    """
    Executes a GAQL query via Google Ads v17 searchStream endpoint.
    """
    url = f"https://googleads.googleapis.com/{GOOGLE_API_VERSION}/customers/{GOOGLE_CUSTOMER_ID}/googleAds:searchStream"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "developer-token": GOOGLE_DEVELOPER_TOKEN,
        "login-customer-id": GOOGLE_CUSTOMER_ID,
        "Content-Type": "application/json"
    }

    try:
        res = requests.post(url, headers=headers, json={"query": query}, timeout=20)
        if res.status_code == 200:
            return res.json()
        else:
            logger.error(f"Google Ads API searchStream error: {res.status_code} {res.text}")
            log_event("GOOGLE_QUERY", "ERROR", f"API Error {res.status_code}: {res.text}")
    except Exception as e:
        logger.error(f"Exception executing Google Ads query: {e}")
    return []

def collect_google_stats(target_date: str = None) -> dict:
    """
    Main collector function for Google Search Ads.
    target_date: 'YYYY-MM-DD'. If None, defaults to yesterday.
    """
    if not target_date:
        target_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    logger.info(f"[Google Collector] Starting collection for {target_date}...")

    access_token = get_google_access_token()
    if not access_token:
        logger.warning(f"[Google Collector] Skipping Google Ads collection (No valid token).")
        log_event("GOOGLE_COLLECT", "WARNING", "Token missing or expired. Run get_google_token.py")
        return {"success": False, "error": "No valid access token"}

    # 1. Campaign Level Performance Query
    campaign_query = f"""
    SELECT
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date = '{target_date}'
    """

    results = query_google_ads(campaign_query, access_token)
    total_spend = 0
    total_impressions = 0
    total_clicks = 0

    for batch in results:
        for row in batch.get("results", []):
            m = row.get("metrics", {})
            cost_micros = int(m.get("costMicros") or 0)
            spend = round(cost_micros / 1000000)
            impr = int(m.get("impressions") or 0)
            clicks = int(m.get("clicks") or 0)

            total_spend += spend
            total_impressions += impr
            total_clicks += clicks

    # 2. Search Term Level Query (Google Ads 검색어 탭)
    search_term_query = f"""
    SELECT
      search_term_view.search_term,
      campaign.name,
      ad_group.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.average_cpc
    FROM search_term_view
    WHERE segments.date = '{target_date}'
    """

    st_results = query_google_ads(search_term_query, access_token)
    st_dict = {}

    for batch in st_results:
        for row in batch.get("results", []):
            st_text = row.get("searchTermView", {}).get("searchTerm", "").strip()
            if not st_text:
                continue
            camp_name = row.get("campaign", {}).get("name", "")
            ag_name = row.get("adGroup", {}).get("name", "")
            m = row.get("metrics", {})

            cost_micros = int(m.get("costMicros") or 0)
            spend = round(cost_micros / 1000000)
            impr = int(m.get("impressions") or 0)
            clicks = int(m.get("clicks") or 0)

            if clicks > 0 or spend > 0:
                if st_text not in st_dict:
                    st_dict[st_text] = {
                        "date": target_date,
                        "keyword": st_text,
                        "media": "구글 검색광고",
                        "campaign": camp_name,
                        "adgroup": ag_name,
                        "impressions": 0,
                        "clicks": 0,
                        "spend": 0,
                    }
                st_dict[st_text]["impressions"] += impr
                st_dict[st_text]["clicks"] += clicks
                st_dict[st_text]["spend"] += spend

    keyword_records = []
    for st_text, data in st_dict.items():
        c = data["clicks"]
        s = data["spend"]
        i = data["impressions"]
        data["cpc"] = round(s / c) if c > 0 else 0
        data["ctr"] = round((c / i) * 100, 2) if i > 0 else 0.0
        keyword_records.append(data)

    # Reconcile with total campaign clicks to handle Google's privacy masking
    sum_st_clicks = sum(r["clicks"] for r in keyword_records)
    sum_st_spend = sum(r["spend"] for r in keyword_records)
    rem_clicks = total_clicks - sum_st_clicks
    rem_spend = total_spend - sum_st_spend

    if rem_clicks > 0:
        keyword_records.append({
            "date": target_date,
            "keyword": "기타 검색어",
            "media": "구글 검색광고",
            "campaign": "Google Ads",
            "adgroup": "Privacy Masked",
            "impressions": 0,
            "clicks": rem_clicks,
            "spend": max(0, rem_spend),
            "cpc": round(rem_spend / rem_clicks) if rem_spend > 0 else 0,
            "ctr": 0.0
        })

    # Sort keywords by clicks DESC, spend DESC
    keyword_records.sort(key=lambda x: (x["clicks"], x["spend"]), reverse=True)

    # Save to SQLite
    media_record = [{
        "date": target_date,
        "media": "GOOGLE_SA",
        "spend": total_spend,
        "impressions": total_impressions,
        "clicks": total_clicks
    }]

    save_daily_media_records(media_record)
    if keyword_records:
        try:
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("DELETE FROM keyword_performance WHERE date = ? AND (media = '구글 검색광고' OR media = 'GOOGLE_SA')", (target_date,))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.warning(f"Error cleaning previous keywords for {target_date}: {e}")
        save_keyword_records(keyword_records)

    log_event(
        "GOOGLE_COLLECT",
        "SUCCESS",
        f"Collected {target_date}: Spend ₩{total_spend:,}, Clicks {total_clicks:,}"
    )

    logger.info(f"[Google Collector] Finished. Total Spend: ₩{total_spend:,}, Clicks: {total_clicks}")
    return {
        "success": True,
        "date": target_date,
        "spend": total_spend,
        "impressions": total_impressions,
        "clicks": total_clicks,
        "keywords_count": len(keyword_records)
    }

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    res = collect_google_stats()
    print("Google Collection Result:", res)
