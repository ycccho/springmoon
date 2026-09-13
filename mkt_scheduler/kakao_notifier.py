import os
import json
import logging
from datetime import datetime
import requests

from .config import (
    KAKAO_REST_API_KEY,
    KAKAO_CLIENT_SECRET,
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
    if KAKAO_CLIENT_SECRET:
        payload["client_secret"] = KAKAO_CLIENT_SECRET
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

def _format_channel_block(label: str, ch_data: dict) -> list:
    lines = []
    spend = ch_data.get("spend", 0)
    clicks = ch_data.get("clicks", 0)
    impr = ch_data.get("impressions", 0)
    cpc = round(float(ch_data.get("cpc", 0) or 0))
    lines.append(f"▶ {label}: ₩{spend:,} ({clicks}클릭 / {impr:,}노출 / CPC ₩{cpc:,})")
    
    kws = ch_data.get("top_keywords", [])
    if kws:
        kw_strs = [f"{k['keyword']}({k['clicks']}클릭)" for k in kws[:4]]
        lines.append(f"  • 유입 키워드: {', '.join(kw_strs)}")
    return lines

def _format_diff_line(label: str, curr_val: int, prev_val: int, unit: str = "원", is_cpc: bool = False) -> str:
    diff = curr_val - prev_val
    if prev_val > 0:
        pct = round((abs(diff) / prev_val) * 100, 1)
        pct_str = f" ({pct}%)"
    else:
        pct_str = ""

    prefix = "₩" if unit == "원" else ""
    suffix = "" if unit == "원" else unit

    if diff > 0:
        badge = "🔺 상승" if is_cpc else "🔺 증가"
        return f"• {label}: {prefix}{curr_val:,}{suffix} (전기 대비 +{prefix}{diff:,}{suffix}{pct_str} {badge})"
    elif diff < 0:
        badge = "🔻 절감(효율 UP!)" if is_cpc else "🔻 감소"
        return f"• {label}: {prefix}{curr_val:,}{suffix} (전기 대비 -{prefix}{abs(diff):,}{suffix}{pct_str} {badge})"
    else:
        return f"• {label}: {prefix}{curr_val:,}{suffix} (전기와 동일)"

def format_daily_report(stats: dict, prev_stats: dict = None) -> str:
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
    gfa = bd.get("NAVER_GFA", {})

    lines = [
        f"📢 [광고 성과 일간 리포트 ({target_date})]",
        "━━━━━━━━━━━━━━━━━━━━━",
        f"💰 소진 광고비: ₩{total_spend:,}",
        f"👆 유입 클릭수: {total_clicks:,}회 (광고 누르고 유입된 수)",
        f"👀 광고 노출수: {total_impr:,}회 (화면에 보여진 수)",
        f"🎯 클릭단가(CPC): ₩{avg_cpc:,} (고객 1명당 유입비용)",
        f"⚡ 클릭 반응률: {avg_ctr}% (100명 중 클릭 비율)",
        "━━━━━━━━━━━━━━━━━━━━━",
        "📊 [전일(어제) 대비 성과 비교]"
    ]

    if prev_stats and prev_stats.get("has_data"):
        p_spend = prev_stats.get("total_spend", 0)
        p_clicks = prev_stats.get("total_clicks", 0)
        p_cpc = prev_stats.get("avg_cpc", 0)
        lines.append(_format_diff_line("광고비", total_spend, p_spend, "원"))
        lines.append(_format_diff_line("클릭수", total_clicks, p_clicks, "회"))
        lines.append(_format_diff_line("클릭단가", avg_cpc, p_cpc, "원", is_cpc=True))
    else:
        lines.append("※ 비교할 전일(그저께) 데이터가 아직 없습니다.")

    lines.append("━━━━━━━━━━━━━━━━━━━━━")
    lines.append("■ 매체별 실적 & 유입 키워드")

    for label, data in [("파워링크(검색상단)", pl), ("파워컨텐츠(블로그뷰)", pc), ("플레이스(지도광고)", place), ("GFA(배너광고)", gfa)]:
        if data.get("spend", 0) > 0 or data.get("clicks", 0) > 0 or data.get("impressions", 0) > 0:
            lines.extend(_format_channel_block(label, data))

    lines.append("")
    lines.append(f"📊 상세 분석 대시보드:\n{DASHBOARD_URL}")
    return "\n".join(lines).strip()

def format_weekly_report(stats: dict, prev_stats: dict = None) -> str:
    s_date = stats.get("start_date", "")
    e_date = stats.get("end_date", "")
    total_spend = stats.get("total_spend", 0)
    total_impr = stats.get("total_impressions", 0)
    total_clicks = stats.get("total_clicks", 0)
    avg_cpc = stats.get("avg_cpc", 0)
    avg_ctr = stats.get("avg_ctr", 0.0)

    lines = [
        "📢 [광고 성과 주간 종합 리포트]",
        f"기간: {s_date} ~ {e_date} (지난주 7일간)",
        "━━━━━━━━━━━━━━━━━━━━━",
        f"💰 주간 총 광고비: ₩{total_spend:,}",
        f"👆 주간 총 클릭수: {total_clicks:,}회",
        f"👀 주간 총 노출수: {total_impr:,}회",
        f"🎯 주간 평균 CPC: ₩{avg_cpc:,} (CTR {avg_ctr}%)",
        "━━━━━━━━━━━━━━━━━━━━━",
        "📊 [지지난주 대비 성과 비교]"
    ]

    if prev_stats and prev_stats.get("has_data"):
        p_spend = prev_stats.get("total_spend", 0)
        p_clicks = prev_stats.get("total_clicks", 0)
        p_cpc = prev_stats.get("avg_cpc", 0)
        lines.append(_format_diff_line("주간 광고비", total_spend, p_spend, "원"))
        lines.append(_format_diff_line("주간 클릭수", total_clicks, p_clicks, "회"))
        lines.append(_format_diff_line("주간 평균단가", avg_cpc, p_cpc, "원", is_cpc=True))
    else:
        lines.append("※ 비교할 지지난주 데이터가 아직 없습니다.")

    lines.append("━━━━━━━━━━━━━━━━━━━━━")
    lines.append(f"📊 주간 상세 분석 보기:\n{DASHBOARD_URL}")
    return "\n".join(lines).strip()

def format_monthly_report(stats: dict, prev_stats: dict = None) -> str:
    s_date = stats.get("start_date", "")
    e_date = stats.get("end_date", "")
    total_spend = stats.get("total_spend", 0)
    total_impr = stats.get("total_impressions", 0)
    total_clicks = stats.get("total_clicks", 0)
    avg_cpc = stats.get("avg_cpc", 0)
    avg_ctr = stats.get("avg_ctr", 0.0)

    lines = [
        "📢 [광고 성과 월간 종합 리포트]",
        f"기간: {s_date} ~ {e_date} (지난달 1달 전체)",
        "━━━━━━━━━━━━━━━━━━━━━",
        f"💰 월간 총 광고비: ₩{total_spend:,}",
        f"👆 월간 총 클릭수: {total_clicks:,}회",
        f"👀 월간 총 노출수: {total_impr:,}회",
        f"🎯 월간 평균 CPC: ₩{avg_cpc:,} (CTR {avg_ctr}%)",
        "━━━━━━━━━━━━━━━━━━━━━",
        "📊 [지지난달 대비 성과 비교]"
    ]

    if prev_stats and prev_stats.get("has_data"):
        p_spend = prev_stats.get("total_spend", 0)
        p_clicks = prev_stats.get("total_clicks", 0)
        p_cpc = prev_stats.get("avg_cpc", 0)
        lines.append(_format_diff_line("월간 광고비", total_spend, p_spend, "원"))
        lines.append(_format_diff_line("월간 클릭수", total_clicks, p_clicks, "회"))
        lines.append(_format_diff_line("월간 평균단가", avg_cpc, p_cpc, "원", is_cpc=True))
    else:
        lines.append("※ 비교할 지지난달 데이터가 아직 없습니다.")

    lines.append("━━━━━━━━━━━━━━━━━━━━━")
    lines.append(f"📊 월간 상세 분석 보기:\n{DASHBOARD_URL}")
    return "\n".join(lines).strip()
