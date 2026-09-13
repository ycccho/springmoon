import os
import json
import logging
from datetime import datetime
import requests

from .config import (
    KAKAO_REST_API_KEY,
    KAKAO_TOKENS_PATH,
    KAKAO_MEMO_SEND_URL,
    KAKAO_TOKEN_URL,
    DASHBOARD_URL
)
from .db_manager import log_event

logger = logging.getLogger(__name__)

def load_tokens() -> dict:
    if not KAKAO_TOKENS_PATH.exists():
        return {}
    try:
        with open(KAKAO_TOKENS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading kakao tokens: {e}")
        return {}

def save_tokens(tokens: dict):
    try:
        with open(KAKAO_TOKENS_PATH, "w", encoding="utf-8") as f:
            json.dump(tokens, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving kakao tokens: {e}")

def refresh_kakao_access_token() -> str:
    """
    Refreshes the access token using the refresh token.
    If a new refresh token is issued (when < 1 month left), saves it automatically.
    """
    tokens = load_tokens()
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        logger.warning("[Kakao Notifier] No Kakao refresh token found. Run get_kakao_token.py")
        return ""

    payload = {
        "grant_type": "refresh_token",
        "client_id": KAKAO_REST_API_KEY,
        "refresh_token": refresh_token
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded;charset=utf-8"}

    try:
        res = requests.post(KAKAO_TOKEN_URL, data=payload, headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            tokens["access_token"] = data["access_token"]
            tokens["updated_at"] = datetime.now().isoformat()
            if "refresh_token" in data:
                tokens["refresh_token"] = data["refresh_token"]
                logger.info("[Kakao Notifier] Renewed Kakao Refresh Token saved!")
            save_tokens(tokens)
            return tokens["access_token"]
        else:
            logger.error(f"[Kakao Notifier] Token refresh failed ({res.status_code}): {res.text}")
            log_event("KAKAO_AUTH", "ERROR", f"Token refresh error: {res.text}")
    except Exception as e:
        logger.error(f"[Kakao Notifier] Exception refreshing token: {e}")
    return tokens.get("access_token", "")

def send_kakao_memo(message_text: str) -> bool:
    """
    Sends a memo to myself via KakaoTalk Memo API.
    """
    access_token = refresh_kakao_access_token()
    if not access_token:
        logger.warning("[Kakao Notifier] Skipping message dispatch (No access token).")
        log_event("KAKAO_SEND", "SKIPPED", "No access token")
        return False

    template_object = {
        "object_type": "text",
        "text": message_text,
        "link": {
            "web_url": DASHBOARD_URL,
            "mobile_web_url": DASHBOARD_URL
        },
        "button_title": "📊 대시보드 바로가기"
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    }
    data = {
        "template_object": json.dumps(template_object, ensure_ascii=False)
    }

    try:
        res = requests.post(KAKAO_MEMO_SEND_URL, headers=headers, data=data, timeout=15)
        if res.status_code == 200:
            logger.info("[Kakao Notifier] Message successfully sent to KakaoTalk Memo!")
            log_event("KAKAO_SEND", "SUCCESS", "Memo message delivered")
            return True
        else:
            logger.error(f"[Kakao Notifier] Send failed ({res.status_code}): {res.text}")
            log_event("KAKAO_SEND", "ERROR", f"Send failed: {res.text}")
            return False
    except Exception as e:
        logger.error(f"[Kakao Notifier] Exception sending memo: {e}")
        log_event("KAKAO_SEND", "ERROR", str(e))
        return False

def format_daily_report(stats: dict) -> str:
    target_date = stats.get("start_date", "")
    total_spend = stats.get("total_spend", 0)
    total_impr = stats.get("total_impressions", 0)
    total_clicks = stats.get("total_clicks", 0)
    avg_cpc = stats.get("avg_cpc", 0)
    avg_ctr = stats.get("avg_ctr", 0.0)
    bd = stats.get("breakdown", {})

    pl = bd.get("NAVER_POWERLINK", {})
    pc = bd.get("NAVER_POWERCONTENTS", {})
    place = bd.get("NAVER_PLACE", {})
    google = bd.get("GOOGLE_SA", {})

    text = f"""[광고 성과 일간 리포트 ({target_date})]

💰 총 광고비: ₩{total_spend:,}
👁️ 총 노출수: {total_impr:,}회
👆 총 클릭수: {total_clicks:,}회
🎯 평균 CPC: ₩{avg_cpc:,} (CTR {avg_ctr}%)

■ 매체별 실적
• 네이버 파워링크: ₩{pl.get('spend', 0):,} ({pl.get('clicks', 0)}클릭, {pl.get('impressions', 0):,}노출)
• 네이버 파워컨텐츠: ₩{pc.get('spend', 0):,} ({pc.get('clicks', 0)}클릭, {pc.get('impressions', 0):,}노출)
• 네이버 플레이스: ₩{place.get('spend', 0):,} ({place.get('clicks', 0)}클릭, {place.get('impressions', 0):,}노출)
• 구글 검색광고: ₩{google.get('spend', 0):,} ({google.get('clicks', 0)}클릭, {google.get('impressions', 0):,}노출)

실시간 대시보드 확인:
{DASHBOARD_URL}"""
    return text.strip()

def format_weekly_report(stats: dict) -> str:
    s_date = stats.get("start_date", "")
    e_date = stats.get("end_date", "")
    total_spend = stats.get("total_spend", 0)
    total_impr = stats.get("total_impressions", 0)
    total_clicks = stats.get("total_clicks", 0)
    avg_cpc = stats.get("avg_cpc", 0)
    avg_ctr = stats.get("avg_ctr", 0.0)
    bd = stats.get("breakdown", {})

    naver_spend = bd.get("NAVER_POWERLINK", {}).get("spend", 0) + \
                  bd.get("NAVER_POWERCONTENTS", {}).get("spend", 0) + \
                  bd.get("NAVER_PLACE", {}).get("spend", 0)
    google_spend = bd.get("GOOGLE_SA", {}).get("spend", 0)

    naver_pct = round((naver_spend / total_spend) * 100, 1) if total_spend > 0 else 0
    google_pct = round((google_spend / total_spend) * 100, 1) if total_spend > 0 else 0

    text = f"""[광고 성과 주간 종합 리포트]
기간: {s_date} ~ {e_date}

💰 주간 총 지출: ₩{total_spend:,}
👁️ 주간 총 노출: {total_impr:,}회
👆 주간 총 클릭: {total_clicks:,}회
🎯 주간 평균 CPC: ₩{avg_cpc:,} (CTR {avg_ctr}%)

■ 매체별 비중
• 네이버 검색광고: ₩{naver_spend:,} ({naver_pct}%)
• 구글 검색광고: ₩{google_spend:,} ({google_pct}%)

주간 누적 분석 바로가기:
{DASHBOARD_URL}"""
    return text.strip()

def format_monthly_report(stats: dict) -> str:
    s_date = stats.get("start_date", "")
    e_date = stats.get("end_date", "")
    total_spend = stats.get("total_spend", 0)
    total_impr = stats.get("total_impressions", 0)
    total_clicks = stats.get("total_clicks", 0)
    avg_cpc = stats.get("avg_cpc", 0)
    avg_ctr = stats.get("avg_ctr", 0.0)
    bd = stats.get("breakdown", {})

    naver_spend = bd.get("NAVER_POWERLINK", {}).get("spend", 0) + \
                  bd.get("NAVER_POWERCONTENTS", {}).get("spend", 0) + \
                  bd.get("NAVER_PLACE", {}).get("spend", 0)
    google_spend = bd.get("GOOGLE_SA", {}).get("spend", 0)

    text = f"""[광고 성과 월간 종합 리포트]
기간: {s_date} ~ {e_date}

💰 월간 총 지출: ₩{total_spend:,}
👁️ 월간 총 노출: {total_impr:,}회
👆 월간 총 클릭: {total_clicks:,}회
🎯 월간 평균 CPC: ₩{avg_cpc:,} (CTR {avg_ctr}%)

■ 매체별 실적
• 네이버 SA 합계: ₩{naver_spend:,}
• 구글 SA 합계: ₩{google_spend:,}

월간 세부 키워드 리포트:
{DASHBOARD_URL}"""
    return text.strip()
