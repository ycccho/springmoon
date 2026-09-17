import os
import json
import time
import logging
from datetime import datetime, timedelta
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

def _send_single_memo(access_token: str, text: str) -> bool:
    template_object = {
        "object_type": "text",
        "text": text,
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
            return True
        logger.error(f"[Kakao Notifier] Send failed ({res.status_code}): {res.text}")
        return False
    except Exception as e:
        logger.error(f"[Kakao Notifier] Exception sending memo: {e}")
        return False

def send_kakao_memo(message_text: str) -> bool:
    """
    Sends a memo to myself via KakaoTalk Memo API.
    If message exceeds 950 chars (due to heavy keyword/creative volume),
    automatically splits and sends 2 consecutive messages so nothing is truncated.
    """
    access_token = refresh_kakao_access_token()
    if not access_token:
        logger.warning("[Kakao Notifier] Skipping message dispatch (No access token).")
        log_event("KAKAO_SEND", "SKIPPED", "No access token")
        return False

    # Only when text exceeds 950 characters: split into 2 messages
    if len(message_text) > 950:
        logger.info(f"[Kakao Notifier] Message length ({len(message_text)}) exceeds 950 chars. Splitting into 2 messages.")
        sep = "────────────────────\n■ 특이사항"
        if sep in message_text:
            p1, p2 = message_text.split(sep, 1)
            p1_text = p1.strip() + "\n\n(👉 [2/2] 특이사항 및 링크로 계속)"
            p2_text = "📢 [광고 성과 리포트 2/2 | 특이사항]\n────────────────────\n■ 특이사항" + p2
            
            ok1 = _send_single_memo(access_token, p1_text)
            time.sleep(0.5)
            ok2 = _send_single_memo(access_token, p2_text)
            if ok1 and ok2:
                log_event("KAKAO_SEND", "SUCCESS", "2-part memo delivered")
                return True
            return False
        else:
            lines = message_text.split("\n")
            mid = len(lines) // 2
            p1_text = "\n".join(lines[:mid]) + "\n\n(👉 2/2로 계속)"
            p2_text = "(이어짐)\n" + "\n".join(lines[mid:])
            ok1 = _send_single_memo(access_token, p1_text)
            time.sleep(0.5)
            ok2 = _send_single_memo(access_token, p2_text)
            return ok1 and ok2

    # Standard case: 1 single message
    ok = _send_single_memo(access_token, message_text)
    if ok:
        logger.info("[Kakao Notifier] Message successfully sent to KakaoTalk Memo!")
        log_event("KAKAO_SEND", "SUCCESS", "Memo message delivered")
    return ok

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

def josa_eun_neun(word: str) -> str:
    """Returns word with correct Korean subject marker (은/는) based on terminal consonant."""
    if not word:
        return ""
    code = ord(word[-1])
    if 0xAC00 <= code <= 0xD7A3:
        has_jongseong = (code - 0xAC00) % 28 > 0
        return f"{word}{'은' if has_jongseong else '는'}"
    return f"{word}는"

def _format_item_clicks(items: list, is_gfa: bool = False, max_display: int = 15) -> str:
    """
    Formats clicked keywords or creatives with each item on its own line for readability.
    Ensures all clicks are mathematically accounted for.
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

    # Ensure "기타" items appear at the end
    named_items = [x for x in clean_items if "기타" not in x[0]]
    etc_items = [x for x in clean_items if "기타" in x[0]]
    clean_items = named_items + etc_items

    lines = []
    if len(clean_items) <= max_display:
        for name, cl in clean_items:
            lines.append(f"{name}({cl})")
    else:
        top_items = clean_items[:max_display]
        remainder = clean_items[max_display:]
        rem_clicks = sum(cl for _, cl in remainder)
        for name, cl in top_items:
            lines.append(f"{name}({cl})")
        lines.append(f"기타 {len(remainder)}개({rem_clicks})")
    return "\n".join(lines)

def generate_special_notes(stats: dict, prev_stats: dict = None) -> list:
    """
    Checks for notable anomalies or issues:
    1. Irrelevant/Negative keyword detection with balanced business judgment
    2. Channel spent budget with 0 clicks
    3. Exceptional CPC surge (> ₩2,500)
    4. Severe click drop compared to previous period (> 50%)
    If none, returns ['특이사항 없음.']
    """
    notes = []
    bd = stats.get("breakdown", {})
    search_kws = []
    for ch_name in ["NAVER_POWERLINK", "GOOGLE_SA"]:
        ch = bd.get(ch_name, {})
        search_kws.extend(ch.get("top_keywords", []))
    total_clicks = stats.get("total_clicks", 0)
    avg_cpc = stats.get("avg_cpc", 0)

    neg_rules = [
        ("블로그", "블로그", "디자이너 포트폴리오 확인 목적으로 보여 제외 권장"),
        ("이미지", "이미지", "시공 전 참고용일 수 있어 제외/보존 선택"),
        ("사진", "사진", "단순 사례 참고 유입 가능성 커 모니터링 후 판단"),
        ("소품", "소품", "소품 구매 목적이 명확하여 제외 권장"),
        ("가구", "가구", "가구 단품 구매 목적이 강하여 제외 권장"),
        ("의자", "의자", "집기 단품 구매 목적이 강하여 제외 권장"),
        ("조명", "조명", "조명 자재 단품 구매 목적 가능성 높아 제외 권장"),
        ("전시", "전시", "전시회 탐색이나 시공 포트폴리오 관심 가능성 있어 판단 필요"),
        ("박람회", "박람회", "박람회 행사 탐색 목적이 강하여 제외 권장"),
        ("도면", "도면", "설계 자료 수집 목적 가능성 높아 제외 권장 (기획 의뢰 모니터링)"),
        ("평면도", "평면도", "레이아웃 참고 목적으로 견적 전환 추이 보고 판단"),
        ("ppt", "문서", "발표 서식 검색으로 시공 문의와 무관하여 제외 권장"),
        ("템플릿", "문서", "템플릿 서식 검색으로 시공 문의와 무관하여 제외 권장"),
        ("채용", "구인구직", "구인·구직 유입으로 시공 수주와 무관하여 제외 권장"),
        ("구인", "구인구직", "구인·구직 유입으로 시공 수주와 무관하여 제외 권장"),
        ("구직", "구인구직", "구직 목적 유입으로 시공과 무관하여 제외 권장"),
        ("연봉", "구인구직", "기업/연봉 정보 검색으로 시공 문의와 무관하여 제외 권장"),
        ("취업", "취업", "취업 관련 유입으로 시공 문의와 무관하여 제외 권장"),
        ("자격증", "자격증", "자격증 취득 목적 검색으로 시공과 무관하여 제외 권장"),
        ("학원", "학업", "학원 수강 목적 유입으로 시공과 무관하여 제외 권장"),
        ("셀프", "셀프", "직접 시공 정보 탐색으로 계약 전환율 낮아 제외 권장"),
        ("diy", "DIY", "자가 시공 정보 유입으로 전환율 낮아 제외 권장"),
    ]

    flagged = []
    flagged_spend = 0
    flagged_clicks = 0
    for k in search_kws:
        kw = k.get("keyword", "")
        cl = k.get("clicks", 0)
        sp = k.get("spend", 0)
        if kw == "기타 검색어":
            continue
        for term, tag, analysis in neg_rules:
            if term in kw.lower():
                flagged.append({
                    "kw": kw,
                    "tag": tag,
                    "analysis": analysis,
                    "clicks": cl,
                    "spend": sp
                })
                flagged_spend += sp
                flagged_clicks += cl
                break

    if flagged:
        neg_block_lines = [
            f"[제외 키워드 등록 권장 ({flagged_clicks}건 / ₩{flagged_spend:,})]:"
        ]
        for f in flagged[:5]:
            neg_block_lines.append(f"{f['kw']}({f['tag']}): {f['analysis']}")
        if len(flagged) > 5:
            neg_block_lines.append(f"외 {len(flagged)-5}건")
        notes.append("\n".join(neg_block_lines))

    # 2. Budget spent with 0 clicks
    for m_label, ch in [("파워링크", bd.get("NAVER_POWERLINK", {})), 
                        ("구글 검색", bd.get("GOOGLE_SA", {})),
                        ("인스타그램/페이스북", bd.get("META_ADS", {})),
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
    dow_map = ["월", "화", "수", "목", "금", "토", "일"]
    try:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        target_dow = dow_map[dt.weekday()]
        target_label = f"{target_date} ({target_dow})"

        send_dt = dt + timedelta(days=1)
        send_dow = dow_map[send_dt.weekday()]
        send_label = f"{send_dt.strftime('%Y-%m-%d')} ({send_dow})"
    except Exception:
        send_label = target_date
        target_label = target_date

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
        f"📢 [일간 광고 성과 리포트 | {send_label}]",
        "────────────────────",
        f"■ {target_label} 합계 (전일 대비)",
        f"• 총 광고비용: ₩{total_spend:,}{spend_diff_str}",
        f"• 총 클릭수: {total_clicks:,}회{clicks_diff_str}",
        f"• 총 노출수: {total_impr:,}회",
        f"• 평균 클릭단가: ₩{avg_cpc:,}{cpc_diff_str}",
        f"• 클릭률(CTR): {avg_ctr}%",
        "────────────────────",
        "■ 매체별 실적 & 유입 키워드",
        "□네이버"
    ]

    bd = stats.get("breakdown", {})

    def _build_channel_block(label: str, ch: dict) -> str:
        s = ch.get("spend", 0)
        c = ch.get("clicks", 0)
        i = ch.get("impressions", 0)
        cpc = round(float(ch.get("cpc", 0) or 0))
        kws = ch.get("top_keywords", [])

        ch_lines = []
        if c > 0:
            ch_lines.append(f"• {label}: ₩{s:,} ({c}클릭 / CPC ₩{cpc:,})")
            if kws:
                items_str = _format_item_clicks(kws, is_gfa=("GFA" in label), max_display=15)
                if items_str:
                    ch_lines.append(items_str)
        elif s > 0 or i > 0:
            ch_lines.append(f"• {label}: ₩{s:,} (0클릭 / {i:,}노출)")
        else:
            ch_lines.append(f"• {label}: ₩0 (미집행)")
        return "\n".join(ch_lines)

    naver_channels = [
        ("GFA 배너", bd.get("NAVER_GFA", {})),
        ("파워링크", bd.get("NAVER_POWERLINK", {})),
        ("파워컨텐츠", bd.get("NAVER_POWERCONTENTS", {})),
        ("플레이스", bd.get("NAVER_PLACE", {}))
    ]

    google_channels = [
        ("구글 검색광고", bd.get("GOOGLE_SA", {}))
    ]

    # Build Meta block dynamically grouped by campaign
    meta_ch = bd.get("META_ADS", {})
    meta_ads = meta_ch.get("top_keywords", [])
    meta_blocks = []

    if meta_ads or meta_ch.get("spend", 0) > 0:
        # Group by campaign
        campaigns = {}
        for ad in meta_ads:
            cname = ad.get("campaign") or "기본 캠페인"
            if cname not in campaigns:
                campaigns[cname] = []
            campaigns[cname].append(ad)

        for cname, c_ads in campaigns.items():
            c_spend = sum(a.get("spend", 0) for a in c_ads)
            c_clicks = sum(a.get("clicks", 0) for a in c_ads)
            c_cpc = round(c_spend / c_clicks) if c_clicks > 0 else 0

            c_lines = [f"• 캠페인 {cname}: ₩{c_spend:,} ({c_clicks}클릭 / CPC ₩{c_cpc:,})"]

            # Sort order: '기타' adset first, then '학원', then custom/alphabetical
            order_gita = {'사무실': 1, '사옥': 2, '프루아즈': 3, '병원': 4}
            order_hakwon = {'251223 슬라이드 10장 추가': 1, '별하랑': 2, 'EM': 3, 'MBC로 변경 MODE수학': 4}

            def ad_sort_key(x):
                ag = x.get("adgroup", "")
                aname = x.get("keyword", "")
                ag_rank = 0 if ag == "기타" else (1 if ag == "학원" else 2)
                sub_rank = order_gita.get(aname, 99) if ag == "기타" else order_hakwon.get(aname, 99)
                return (ag_rank, sub_rank, aname)

            sorted_c_ads = sorted(c_ads, key=ad_sort_key)
            for a in sorted_c_ads:
                aname = a.get("keyword", "")
                acl = a.get("clicks", 0)
                asp = a.get("spend", 0)
                c_lines.append(f"{aname}({acl} / ₩{asp:,})")

            meta_blocks.append("\n".join(c_lines))
    else:
        meta_blocks.append("• 인스타그램/페이스북: ₩0 (미집행)")

    naver_blocks = [_build_channel_block(label, ch) for label, ch in naver_channels]
    google_blocks = [_build_channel_block(label, ch) for label, ch in google_channels]

    lines.append("\n\n".join(naver_blocks))
    lines.append("")
    lines.append("□구글")
    lines.append("\n\n".join(google_blocks))
    lines.append("")
    lines.append("□메타")
    lines.append("\n\n".join(meta_blocks))

    lines.append("")
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
        ("인스타그램/페이스북", bd.get("META_ADS", {})),
        ("GFA 배너", bd.get("NAVER_GFA", {})),
        ("플레이스", bd.get("NAVER_PLACE", {})),
        ("파워링크", bd.get("NAVER_POWERLINK", {})),
        ("구글 검색", bd.get("GOOGLE_SA", {})),
        ("파워컨텐츠", bd.get("NAVER_POWERCONTENTS", {}))
    ]

    ch_blocks = []
    for label, ch in channels:
        s = ch.get("spend", 0)
        c = ch.get("clicks", 0)
        pct = round((s / total_spend) * 100) if total_spend > 0 else 0
        kws = ch.get("top_keywords", [])

        ch_lines = []
        if c > 0 or s > 0:
            ch_lines.append(f"• {label}: ₩{s:,} ({c}클릭 / {pct}% 비중)")
            if kws:
                items_str = _format_item_clicks(kws, is_gfa=(label == "GFA 배너"), max_display=15)
                if items_str:
                    ch_lines.append(items_str)
        else:
            ch_lines.append(f"• {label}: ₩0 (미집행)")
        ch_blocks.append("\n".join(ch_lines))

    lines.append("\n\n".join(ch_blocks))

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


