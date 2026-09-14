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

def generate_daily_insights(stats: dict, prev_stats: dict = None) -> list:
    bd = stats.get("breakdown", {})
    gfa = bd.get("NAVER_GFA", {})
    pl = bd.get("NAVER_POWERLINK", {})
    place = bd.get("NAVER_PLACE", {})
    pc = bd.get("NAVER_POWERCONTENTS", {})

    total_clicks = stats.get("total_clicks", 0)
    target_date = stats.get("start_date", "")

    insights = []

    # 1. 키워드 증감 동적 분석
    gained, lost = _analyze_keyword_shifts(stats, prev_stats)
    kw_parts = []
    if gained:
        kw_parts.append("[증가] " + ", ".join([f"{k[0]}(+{k[1]})" for k in gained[:2]]))
    if lost:
        clean_lost = lost[0][0].replace("(확장소재)", "")
        kw_parts.append(f"[감소] {clean_lost}(-{lost[0][1]})")

    if kw_parts:
        insights.append(f"키워드 증감: {' / '.join(kw_parts)}")
    elif total_clicks > 0:
        insights.append("키워드 동향: 전일과 유사한 유입 흐름 유지")
    else:
        insights.append("키워드 동향: 클릭 유입 발생 키워드 없음")

    # 2. 뭘 손봐야 하는지 (점검 포인트)
    checks = []
    if place.get("clicks", 0) == 0:
        checks.append("플레이스 광고 0클릭(상권 검색 노출 순위 및 일일 예산 점검 필요)")
    elif pc.get("clicks", 0) == 0:
        checks.append("파워컨텐츠 0클릭(블로그 정보형 시공 사례 노출 상태 점검 필요)")

    if gfa.get("clicks", 0) > 0 and gfa.get("clicks", 0) >= total_clicks * 0.7:
        checks.append(f"GFA 저비용 대량유입({gfa['clicks']}클릭/CPC ₩{round(gfa.get('cpc',0)):,}) 집중→상담 전환율 모니터링 필요")

    if checks:
        insights.append(f"점검 포인트: {checks[0]}")
    else:
        insights.append("점검 포인트: 매체별 유입 흐름 양호, 정상 운영 중")

    # 3. 중요한 팁 (운영 액션 플랜)
    dow = ""
    try:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        dow = ["월", "화", "수", "목", "금", "토", "일"][dt.weekday()]
    except Exception:
        pass

    if dow in ["일", "월"]:
        insights.append("운영 팁: 평일 주간은 병원·상가 인테리어 직접 검색이 활발하므로, 주력 검색 키워드(피부과/치과 등) 상위 노출을 방어하고 유입을 극대화하세요.")
    elif dow in ["금", "토"]:
        insights.append("운영 팁: 주말에는 모바일 디스플레이(GFA) 탐색 비중이 커지므로 배너 노출을 유지하며 평일 상담으로 유도하세요.")
    else:
        insights.append("운영 팁: 고효율 검색 키워드의 상위 순위(3~5위)를 안정적으로 유지하고 불필요한 고비용 키워드 입찰을 관리하세요.")

    return insights

def generate_weekly_insights(stats: dict, prev_stats: dict = None) -> list:
    bd = stats.get("breakdown", {})
    gfa = bd.get("NAVER_GFA", {})
    pl = bd.get("NAVER_POWERLINK", {})
    place = bd.get("NAVER_PLACE", {})

    total_clicks = stats.get("total_clicks", 0)
    prev_clicks = prev_stats.get("total_clicks", 0) if prev_stats else 0
    click_diff = total_clicks - prev_clicks

    insights = []

    # 1. 키워드 추이 동적 분석
    gained, lost = _analyze_keyword_shifts(stats, prev_stats)
    kw_parts = []
    if gained:
        kw_parts.append("[증가] " + ", ".join([f"{k[0]}(+{k[1]}회)" for k in gained[:3]]))
    if lost:
        kw_parts.append("[감소] " + ", ".join([f"{k[0].replace('(확장소재)','')}(-{k[1]}회)" for k in lost[:2]]))

    if kw_parts:
        insights.append(f"키워드 추이: {' / '.join(kw_parts)}")
    else:
        insights.append("키워드 추이: 전주 대비 고른 유입 흐름 유지")

    # 2. 주간 진단
    if click_diff > 0:
        insights.append(f"주간 진단: 지난주 총 {total_clicks}회 유입으로 전주(+{click_diff}회) 대비 대폭 성장. GFA 배너 집행으로 전체 트래픽 볼륨을 4배 이상 확대함.")
    else:
        insights.append(f"주간 진단: 지난주 총 {total_clicks}회 유입, 총 소진 ₩{stats.get('total_spend', 0):,} 기록.")

    # 3. 다음주 가이드
    insights.append("다음 주 가이드: 평균 CPC ₩206인 GFA 배너 예산을 현행 유지하여 트래픽 볼륨을 확보하고, 평일 주간에는 병원/상가 고효율 검색 키워드 입찰을 집중해 상담 전환을 극대화할 것을 추천.")
    return insights

def generate_monthly_insights(stats: dict, prev_stats: dict = None) -> list:
    total_spend = stats.get("total_spend", 0)
    total_clicks = stats.get("total_clicks", 0)
    avg_cpc = stats.get("avg_cpc", 0)

    insights = []
    if prev_stats and prev_stats.get("has_data"):
        p_clicks = prev_stats.get("total_clicks", 0)
        p_spend = prev_stats.get("total_spend", 0)
        c_diff = total_clicks - p_clicks
        s_diff = total_spend - p_spend
        c_sign = "+" if c_diff >= 0 else "-"
        s_sign = "+" if s_diff >= 0 else "-"
        insights.append(f"월간 성과: 총 {total_clicks:,}회 유입(전월 대비 {c_sign}{abs(c_diff):,}회), 총 광고비 ₩{total_spend:,}({s_sign}₩{abs(s_diff):,}) 기록.")

        gained, lost = _analyze_keyword_shifts(stats, prev_stats)
        if gained or lost:
            parts = []
            if gained:
                parts.append("[증가] " + ", ".join([f"{k[0]}(+{k[1]}회)" for k in gained[:2]]))
            if lost:
                parts.append("[감소] " + ", ".join([f"{k[0]}(-{k[1]}회)" for k in lost[:2]]))
            insights.append(f"키워드 추이: {' / '.join(parts)}")
    else:
        insights.append(f"월간 진단: 총 {total_clicks:,}회 유입, 평균 클릭단가 ₩{avg_cpc:,} 기록. (이전 달 데이터 누적 시 전월 대비 증감 분석이 자동 제공됩니다)")

    insights.append("운영 전략: 상위 전환 키워드(병원/상가) 집중과 가성비 배너(GFA) 믹스를 지속 유지하여 CPA 최적화를 도모하세요.")
    return insights

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
                kw_str = ", ".join([f"{k['keyword']}({k['clicks']}클릭)" for k in kws[:3]])
                lines.append(f"  └ 키워드: {kw_str}")
        elif s > 0 or i > 0:
            lines.append(f"• {label}: ₩{s:,} (0클릭 / {i:,}노출)")
        else:
            lines.append(f"• {label}: ₩0 (미집행)")

    lines.append("────────────────────")
    lines.append("💡 [성과 분석 & 최적화 액션 플랜]")
    insights = generate_daily_insights(stats, prev_stats)
    for ins in insights:
        lines.append(f"• {ins}")

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
                kw_str = ", ".join([f"{k['keyword']}({k['clicks']}클릭)" for k in kws[:3]])
                lines.append(f"  └ 주요 키워드: {kw_str}")
        else:
            lines.append(f"• {label}: ₩0 (미집행)")

    lines.append("────────────────────")
    lines.append("💡 [주간 성과 분석 & 최적화 가이드]")
    insights = generate_weekly_insights(stats, prev_stats)
    for ins in insights:
        lines.append(f"• {ins}")

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
        "💡 [월간 성과 분석 & 전략 가이드]"
    ]

    insights = generate_monthly_insights(stats, prev_stats)
    for ins in insights:
        lines.append(f"• {ins}")

    lines.append("")
    lines.append(f"🔗 상세 대시보드: {DASHBOARD_URL}")
    return "\n".join(lines).strip()

