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

def _format_diff(curr_val: int, prev_val: int, unit: str = "원", is_cpc: bool = False) -> str:
    diff = curr_val - prev_val
    if diff == 0:
        return "전기 동일"
    prefix = "₩" if unit == "원" else ""
    suffix = "" if unit == "원" else unit
    sign = "+" if diff > 0 else "-"
    abs_diff = abs(diff)

    pct_str = ""
    if prev_val > 0:
        pct = round((abs_diff / prev_val) * 100, 1)
        # Only show percentage if base value is meaningful and pct is not an absurd multiple
        if (unit == "회" and prev_val >= 5 and pct <= 500) or (unit == "원" and prev_val >= 3000 and pct <= 500):
            pct_str = f" ({pct}%)"

    badge = "🔺" if diff > 0 else "🔻"
    return f"{sign}{prefix}{abs_diff:,}{suffix}{pct_str} {badge}"

def _analyze_keyword_shifts(stats: dict, prev_stats: dict) -> tuple:
    """
    Compares keywords between current stats and previous stats.
    Returns (gained_list, lost_list).
    Each item: (keyword, diff_clicks, curr_clicks, prev_clicks)
    """
    curr_kws = {}
    for ch in stats.get("breakdown", {}).values():
        for k in ch.get("top_keywords", []):
            kw = k.get("keyword")
            if kw and not kw.startswith("플레이스 광고 ("):
                curr_kws[kw] = curr_kws.get(kw, 0) + int(k.get("clicks") or 0)

    prev_kws = {}
    if prev_stats:
        for ch in prev_stats.get("breakdown", {}).values():
            for k in ch.get("top_keywords", []):
                kw = k.get("keyword")
                if kw and not kw.startswith("플레이스 광고 ("):
                    prev_kws[kw] = prev_kws.get(kw, 0) + int(k.get("clicks") or 0)

    gained = []
    lost = []
    all_kws = set(curr_kws.keys()) | set(prev_kws.keys())
    for kw in all_kws:
        c_clicks = curr_kws.get(kw, 0)
        p_clicks = prev_kws.get(kw, 0)
        diff = c_clicks - p_clicks
        if diff > 0 and c_clicks > 0:
            gained.append((kw, diff, c_clicks, p_clicks))
        elif diff < 0 and p_clicks > 0:
            lost.append((kw, abs(diff), c_clicks, p_clicks))

    gained.sort(key=lambda x: x[1], reverse=True)
    lost.sort(key=lambda x: x[1], reverse=True)
    return gained, lost

def _format_item_clicks(items: list, is_gfa: bool = False, max_display: int = 10) -> str:
    """
    Formats clicked keywords or creatives ensuring all clicks are mathematically accounted for.
    If items exceed max_display, lists top items and explicitly groups remainder into '기타 N개(N클릭)'
    so the sum ALWAYS equals total clicks.
    """
    if not items:
        return ""
    clean_items = []
    for k in items:
        name = k.get("keyword", "")
        if is_gfa:
            name = name.replace("[소재] ", "")
        cl = k.get("clicks", 0)
        if cl > 0:
            clean_items.append((name, cl))

    if not clean_items:
        return ""

    total_clicks = sum(cl for _, cl in clean_items)
    label = "소재" if is_gfa else "검색어"
    if len(clean_items) <= max_display:
        parts = [f"{name}({cl})" for name, cl in clean_items]
        return f"  └ {label}(총 {total_clicks}클릭): " + ", ".join(parts)
    else:
        top_items = clean_items[:max_display]
        remainder = clean_items[max_display:]
        rem_clicks = sum(cl for _, cl in remainder)
        parts = [f"{name}({cl})" for name, cl in top_items]
        parts.append(f"기타 {len(remainder)}개({rem_clicks})")
        return f"  └ {label}(총 {total_clicks}클릭): " + ", ".join(parts)

def generate_special_notes(stats: dict, prev_stats: dict = None) -> list:
    """
    Checks for notable anomalies or issues:
    1. Irrelevant/Negative keyword detection in PowerLink search queries
    2. Channel spent budget with 0 clicks
    3. Exceptional CPC surge (> ₩2,500)
    4. Severe click drop compared to previous period (> 50%)
    If none, returns ['특이사항 없음.']
    """
    notes = []
    bd = stats.get("breakdown", {})
    pl = bd.get("NAVER_POWERLINK", {})
    pl_kws = pl.get("top_keywords", [])
    total_clicks = stats.get("total_clicks", 0)
    avg_cpc = stats.get("avg_cpc", 0)

    # 1. Negative search query rules for interior company
    neg_rules = [
        ("이미지", "이미지 탐색"),
        ("사진", "사진 검색"),
        ("도면", "도면/자료 검색"),
        ("평면도", "평면도 검색"),
        ("ppt", "문서 자료 검색"),
        ("블로그", "블로그 탐색"),
        ("소품", "소품 구매 목적"),
        ("전시", "전시회 탐색"),
        ("채용", "구인/구직"),
        ("구인", "구인/구직"),
        ("자격증", "자격증 취득"),
        ("연봉", "구인/구직"),
        ("셀프", "DIY 시공"),
    ]

    flagged = []
    flagged_spend = 0
    flagged_clicks = 0
    for k in pl_kws:
        kw = k.get("keyword", "")
        cl = k.get("clicks", 0)
        sp = k.get("spend", 0)
        for term, reason in neg_rules:
            if term in kw.lower():
                flagged.append(f"'{kw}'({reason})")
                flagged_spend += sp
                flagged_clicks += cl
                break

    if flagged:
        kw_list_str = ", ".join(flagged[:4])
        if len(flagged) > 4:
            kw_list_str += f" 외 {len(flagged)-4}건"
        notes.append(f"[제외 키워드 등록 권장]: {kw_list_str} 등 인테리어 시공 문의와 무관한 유입({flagged_clicks}건 / ₩{flagged_spend:,})이 확인되었습니다. 불필요한 예산 낭비를 방지하기 위해 파워링크 [제외 키워드]로 등록하여 차단하세요.")

    # 2. Budget spent with 0 clicks
    for m_label, ch in [("파워링크", bd.get("NAVER_POWERLINK", {})), 
                        ("파워컨텐츠", bd.get("NAVER_POWERCONTENTS", {})), 
                        ("플레이스", bd.get("NAVER_PLACE", {})), 
                        ("GFA 배너", bd.get("NAVER_GFA", {}))]:
        sp = ch.get("spend", 0)
        if sp >= 3000 and ch.get("clicks", 0) == 0:
            notes.append(f"{m_label} 광고에서 ₩{sp:,} 소진되었으나 유입 클릭이 0건입니다.")

    # 3. Exceptional CPC surge
    if avg_cpc >= 2500 and total_clicks > 0:
        notes.append(f"평균 클릭단가(₩{avg_cpc:,})가 비정상적으로 높게 형성되어 점검이 필요합니다.")

    # 4. Severe click drop compared to previous period
    if prev_stats and prev_stats.get("has_data"):
        p_clicks = prev_stats.get("total_clicks", 0)
        if p_clicks >= 20 and total_clicks <= p_clicks * 0.5:
            notes.append(f"전체 클릭수({total_clicks}회)가 전기({p_clicks}회) 대비 50% 이상 급감했습니다.")

    if not notes:
        return ["특이사항 없음."]
    return notes

def format_daily_report(stats: dict, prev_stats: dict = None) -> str:
    target_date = stats.get("start_date", "")
    try:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        dow = ["월", "화", "수", "목", "금", "토", "일"][dt.weekday()]
        date_label = f"{target_date} ({dow})"
    except Exception:
        date_label = target_date

    total_spend = stats.get("total_spend", 0)
    total_clicks = stats.get("total_clicks", 0)
    total_impr = stats.get("total_impressions", 0)
    avg_cpc = stats.get("avg_cpc", 0)
    avg_ctr = stats.get("avg_ctr", 0.0)

    p_spend = prev_stats.get("total_spend", 0) if prev_stats else 0
    p_clicks = prev_stats.get("total_clicks", 0) if prev_stats else 0
    p_cpc = prev_stats.get("avg_cpc", 0) if prev_stats else 0

    has_prev = prev_stats and prev_stats.get("has_data")
    spend_diff_str = f" ({_format_diff(total_spend, p_spend, '원')})" if has_prev else ""
    clicks_diff_str = f" ({_format_diff(total_clicks, p_clicks, '회')})" if has_prev else ""
    cpc_diff_str = f" ({_format_diff(avg_cpc, p_cpc, '원', is_cpc=True)})" if has_prev else ""

    lines = [
        f"📢 [일간 광고 성과 리포트 | {date_label}]",
        "────────────────────",
        "■ 핵심 실적 (전일 대비)",
        f"• 소진 광고비: ₩{total_spend:,}{spend_diff_str}",
        f"• 유입 클릭수: {total_clicks:,}회{clicks_diff_str}",
        f"• 총 노출수: {total_impr:,}회",
        f"• 평균 클릭단가: ₩{avg_cpc:,}{cpc_diff_str}",
        f"• 클릭률(CTR): {avg_ctr}%",
        "────────────────────",
        "■ 매체별 실적 & 유입 키워드"
    ]

    bd = stats.get("breakdown", {})
    channels = [
        ("GFA 배너", bd.get("NAVER_GFA", {})),
        ("파워링크", bd.get("NAVER_POWERLINK", {})),
        ("파워컨텐츠", bd.get("NAVER_POWERCONTENTS", {})),
        ("플레이스", bd.get("NAVER_PLACE", {}))
    ]

    for label, ch in channels:
        s = ch.get("spend", 0)
        c = ch.get("clicks", 0)
        i = ch.get("impressions", 0)
        cpc = round(float(ch.get("cpc", 0) or 0))
        kws = ch.get("top_keywords", [])

        if c > 0:
            lines.append(f"• {label}: ₩{s:,} ({c}클릭 / CPC ₩{cpc:,})")
            if kws:
                lines.append(_format_item_clicks(kws, is_gfa=(label == "GFA 배너"), max_display=10))
        elif s > 0 or i > 0:
            lines.append(f"• {label}: ₩{s:,} (0클릭 / {i:,}노출)")
        else:
            lines.append(f"• {label}: ₩0 (미집행)")

    lines.append("────────────────────")
    lines.append("■ 특이사항")
    notes = generate_special_notes(stats, prev_stats)
    for n in notes:
        lines.append(f"• {n}")

    lines.append("")
    lines.append(f"🔗 상세 대시보드: {DASHBOARD_URL}")
    return "\n".join(lines).strip()


def format_weekly_report(stats: dict, prev_stats: dict = None) -> str:
    s_date = stats.get("start_date", "")
    e_date = stats.get("end_date", "")
    try:
        s_s = s_date.replace("2026-", "")
        e_s = e_date.replace("2026-", "")
        date_label = f"{s_s} ~ {e_s}"
    except Exception:
        date_label = f"{s_date} ~ {e_date}"

    total_spend = stats.get("total_spend", 0)
    total_clicks = stats.get("total_clicks", 0)
    total_impr = stats.get("total_impressions", 0)
    avg_cpc = stats.get("avg_cpc", 0)
    avg_ctr = stats.get("avg_ctr", 0.0)

    p_spend = prev_stats.get("total_spend", 0) if prev_stats else 0
    p_clicks = prev_stats.get("total_clicks", 0) if prev_stats else 0
    p_cpc = prev_stats.get("avg_cpc", 0) if prev_stats else 0

    has_prev = prev_stats and prev_stats.get("has_data")
    spend_diff_str = f" ({_format_diff(total_spend, p_spend, '원')})" if has_prev else ""
    clicks_diff_str = f" ({_format_diff(total_clicks, p_clicks, '회')})" if has_prev else ""
    cpc_diff_str = f" ({_format_diff(avg_cpc, p_cpc, '원', is_cpc=True)})" if has_prev else ""

    lines = [
        f"📢 [주간 광고 종합 리포트 | {date_label}]",
        "────────────────────",
        "■ 지난주 총 실적 (지지난주 대비)",
        f"• 총 광고비: ₩{total_spend:,}{spend_diff_str}",
        f"• 총 클릭수: {total_clicks:,}회{clicks_diff_str}",
        f"• 총 노출수: {total_impr:,}회",
        f"• 평균 클릭단가: ₩{avg_cpc:,}{cpc_diff_str}",
        f"• 클릭률(CTR): {avg_ctr}%",
        "────────────────────",
        "■ 매체별 비중 & 주요 유입"
    ]

    bd = stats.get("breakdown", {})
    channels = [
        ("GFA 배너", bd.get("NAVER_GFA", {})),
        ("플레이스", bd.get("NAVER_PLACE", {})),
        ("파워링크", bd.get("NAVER_POWERLINK", {})),
        ("파워컨텐츠", bd.get("NAVER_POWERCONTENTS", {}))
    ]

    for label, ch in channels:
        s = ch.get("spend", 0)
        c = ch.get("clicks", 0)
        pct = round((s / total_spend) * 100) if total_spend > 0 else 0
        kws = ch.get("top_keywords", [])

        if c > 0 or s > 0:
            lines.append(f"• {label}: ₩{s:,} ({c}클릭 / {pct}% 비중)")
            if kws:
                lines.append(_format_item_clicks(kws, is_gfa=(label == "GFA 배너"), max_display=10))
        else:
            lines.append(f"• {label}: ₩0 (미집행)")

    lines.append("────────────────────")
    lines.append("■ 특이사항")
    notes = generate_special_notes(stats, prev_stats)
    for n in notes:
        lines.append(f"• {n}")

    lines.append("")
    lines.append(f"🔗 상세 대시보드: {DASHBOARD_URL}")
    return "\n".join(lines).strip()

def format_monthly_report(stats: dict, prev_stats: dict = None) -> str:
    s_date = stats.get("start_date", "")
    e_date = stats.get("end_date", "")
    total_spend = stats.get("total_spend", 0)
    total_clicks = stats.get("total_clicks", 0)
    total_impr = stats.get("total_impressions", 0)
    avg_cpc = stats.get("avg_cpc", 0)
    avg_ctr = stats.get("avg_ctr", 0.0)

    p_spend = prev_stats.get("total_spend", 0) if prev_stats else 0
    p_clicks = prev_stats.get("total_clicks", 0) if prev_stats else 0
    p_cpc = prev_stats.get("avg_cpc", 0) if prev_stats else 0

    has_prev = prev_stats and prev_stats.get("has_data")
    spend_diff_str = f" ({_format_diff(total_spend, p_spend, '원')})" if has_prev else ""
    clicks_diff_str = f" ({_format_diff(total_clicks, p_clicks, '회')})" if has_prev else ""
    cpc_diff_str = f" ({_format_diff(avg_cpc, p_cpc, '원', is_cpc=True)})" if has_prev else ""

    lines = [
        f"📢 [월간 광고 종합 리포트 | {s_date} ~ {e_date}]",
        "────────────────────",
        "■ 지난달 총 실적 (지지난달 대비)",
        f"• 월간 광고비: ₩{total_spend:,}{spend_diff_str}",
        f"• 월간 클릭수: {total_clicks:,}회{clicks_diff_str}",
        f"• 월간 노출수: {total_impr:,}회",
        f"• 평균 클릭단가: ₩{avg_cpc:,}{cpc_diff_str}",
        f"• 클릭률(CTR): {avg_ctr}%",
        "────────────────────",
        "■ 특이사항"
    ]

    notes = generate_special_notes(stats, prev_stats)
    for n in notes:
        lines.append(f"• {n}")

    lines.append("")
    lines.append(f"🔗 상세 대시보드: {DASHBOARD_URL}")
    return "\n".join(lines).strip()


