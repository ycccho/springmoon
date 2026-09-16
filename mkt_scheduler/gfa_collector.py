import sys
import time
import json
import logging
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

from .db_manager import save_daily_media_records, save_keyword_records, log_event

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
PROFILE_DIR = BASE_DIR / "gfa_profile"

def collect_gfa_stats(target_date: str) -> dict:
    """
    Collects GFA (성과형 디스플레이 광고) performance and Place Ads clicked keywords for target_date.
    Uses the persistent authenticated session in gfa_profile to query
    Naver Ads internal APIs in headless mode.
    """
    logger.info(f"[GFA/Place Collector] Starting collection for {target_date}...")

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument(f"--user-data-dir={PROFILE_DIR.resolve()}")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")

    driver = None
    try:
        driver = webdriver.Chrome(options=options)
        driver.get("https://ads.naver.com/manage/ad-accounts/225690/all-campaigns")
        time.sleep(3)

        # 1. GFA DA Campaigns
        js_query = f"""
        const res = await fetch('https://ads.naver.com/apis/dashboard/v1/adAccounts/225690/campaigns/search', {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json' }},
            body: JSON.stringify({{
                startDate: '{target_date}',
                endDate: '{target_date}',
                pageNumber: 1,
                pageSize: 50
            }})
        }});
        return await res.json();
        """

        data = driver.execute_script(f"return (async () => {{ {js_query} }})();")
        
        gfa_spend = 0
        gfa_clicks = 0
        gfa_impr = 0

        for item in data.get("results", []):
            c = item.get("campaign", {})
            m = item.get("metrics", {})
            ad_platform = c.get("adPlatform")
            name = c.get("name", "")

            # Match GFA / DA campaigns, especially '네이티브'
            if ad_platform == "DA":
                s = round(m.get("grossCostMicros", 0) / 1000000)
                cl = m.get("clicks", 0)
                im = m.get("impressions", 0)

                gfa_spend += s
                gfa_clicks += cl
                gfa_impr += im
                logger.info(f"[GFA Collector] Found DA Campaign: {name} - Spend: ₩{s:,}, Clicks: {cl}, Impr: {im:,}")

        # Save GFA to SQLite
        if gfa_spend > 0 or gfa_clicks > 0 or gfa_impr > 0:
            rec = [{
                "date": target_date,
                "media": "NAVER_GFA",
                "spend": gfa_spend,
                "impressions": gfa_impr,
                "clicks": gfa_clicks
            }]
            save_daily_media_records(rec)
            log_event("GFA_COLLECTOR", "SUCCESS", f"Collected ₩{gfa_spend:,} ({gfa_clicks} clicks)")
            logger.info(f"[GFA Collector] Successfully saved NAVER_GFA: ₩{gfa_spend:,} / {gfa_clicks} clicks / {gfa_impr:,} impr")

            # 1-1. Collect GFA creative performance (소재별 클릭/비용)
            try:
                js_gfa_creatives = f"""
                let gfaCreatives = [];
                try {{
                    const resC = await fetch('https://ads.naver.com/apis/gfa/v1/adAccounts/225690/creatives/draft/searchCreativesByAdSetNo?adSetNo=4035171&page=0&size=100&inspectionStatus=PENDING&inspectionStatus=REJECT&inspectionStatus=ACCEPT&inspectionStatus=PENDING_IN_OPERATION&inspectionStatus=REJECT_IN_OPERATION&onOffs=1&onOffs=0');
                    const cData = await resC.json();
                    const realNos = [];
                    const cMap = {{}};
                    for (const c of (cData.content || [])) {{
                        const rNo = c.realCreativeNo || c.no;
                        realNos.push(rNo);
                        cMap[rNo] = {{ name: c.name, message: c.message }};
                    }}
                    if (realNos.length > 0) {{
                        const params = realNos.map(no => 'creativeNoList=' + no).join('&');
                        const resStats = await fetch(`https://ads.naver.com/apis/gfa/v2/adAccounts/225690/stats/creativeStats?${{params}}&startDate={target_date}&endDate={target_date}`);
                        const sData = await resStats.json();
                        for (const [rNo, st] of Object.entries(sData)) {{
                            if (st && st.clickCount > 0) {{
                                gfaCreatives.push({{
                                    no: rNo,
                                    name: cMap[rNo] ? cMap[rNo].name : ('소재 #' + rNo),
                                    clicks: st.clickCount,
                                    spend: st.sales || 0,
                                    impr: st.impCount || 0,
                                    cpc: st.cpc || 0
                                }});
                            }}
                        }}
                    }}
                }} catch(e) {{}}
                return gfaCreatives;
                """
                gfa_cr_list = driver.execute_script(f"return (async () => {{ {js_gfa_creatives} }})();")
                if gfa_cr_list:
                    gfa_kw_records = []
                    for cr in gfa_cr_list:
                        gfa_kw_records.append({
                            "date": target_date,
                            "keyword": f"[소재] {cr['name']}",
                            "media": "NAVER_GFA",
                            "campaign": "네이티브",
                            "adgroup": "네이티브",
                            "impressions": cr["impr"],
                            "clicks": cr["clicks"],
                            "spend": cr["spend"],
                            "cpc": cr["cpc"],
                            "ctr": round((cr["clicks"] / cr["impr"]) * 100, 2) if cr["impr"] > 0 else 0.0
                        })
                    save_keyword_records(gfa_kw_records)
                    logger.info(f"[GFA Collector] Successfully saved {len(gfa_kw_records)} GFA creative records for {target_date}")
            except Exception as cr_err:
                logger.warning(f"[GFA Collector] Failed to fetch GFA creatives: {cr_err}")
        else:
            logger.info(f"[GFA Collector] No GFA spend recorded on {target_date}.")


        # 2. Place Ads Clicked Keywords (admng_exp_keyword for both campaigns)
        place_groups = [
            ("grp-a001-06-000000033815651", "2. 플레이스(법인)", "인디 스마트플레이스"),
            ("grp-a001-06-000000043582328", "3. 플레이스(상가 사무실)", "플레이스(상가사무실)_그룹#1")
        ]
        place_kw_records = []
        for ag_id, camp_name, group_name in place_groups:
            js_place = f"""
            function getCookie(name) {{
                const value = `; ` + document.cookie;
                const parts = value.split(`; ` + name + `=`);
                if (parts.length === 2) return parts.pop().split(';').shift();
                return '';
            }}
            const payload = {{
              "domain": "admng_exp_keyword",
              "cols": {{
                "keys": [
                  {{
                    "columns": [
                      {{"code": "customerId", "isSelected": true, "filter": {{"value": "1610516"}}, "isGroupBy": true}},
                      {{"code": "nccAdgroupId", "isSelected": true, "filter": {{"value": ["{ag_id}"]}}, "isGroupBy": true}},
                      {{"code": "ymd", "isSelected": true, "filter": {{"value": {{"from": "{target_date}", "to": "{target_date}"}}}}, "isGroupBy": false}},
                      {{"code": "expKeyword", "isSelected": true, "filter": {{}}, "sort": "-", "isGroupBy": true}}
                    ]
                  }}
                ]
              }}
            }};
            const res = await fetch('https://ads.naver.com/apis/sa/api/adata/admng_exp_keyword', {{
                method: 'POST',
                headers: {{
                    'Content-Type': 'application/json',
                    'X-AD-customer-id': '1610516',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN')
                }},
                body: JSON.stringify(payload)
            }});
            return await res.json();
            """
            try:
                place_data = driver.execute_script(f"return (async () => {{ {js_place} }})();")
                for pk in place_data.get("data", []):
                    cl = int(pk.get("clkCnt") or 0)
                    if cl > 0:
                        imp = int(pk.get("impCnt") or 0)
                        sp = int(pk.get("salesAmt") or 0)
                        place_kw_records.append({
                            "date": target_date,
                            "keyword": pk.get("expKeyword", ""),
                            "media": "NAVER_PLACE",
                            "campaign": camp_name,
                            "adgroup": group_name,
                            "impressions": imp,
                            "clicks": cl,
                            "spend": sp,
                            "cpc": round(sp / cl, 1) if cl > 0 else 0,
                            "ctr": round((cl / imp) * 100, 2) if imp > 0 else 0
                        })
            except Exception as ag_err:
                logger.warning(f"[GFA/Place Collector] Error querying group {ag_id}: {ag_err}")

        if place_kw_records:
            save_keyword_records(place_kw_records)
            logger.info(f"[GFA/Place Collector] Successfully saved {len(place_kw_records)} Place clicked keywords for {target_date}")

        return {
            "success": True,
            "spend": gfa_spend,
            "clicks": gfa_clicks,
            "impressions": gfa_impr,
            "cpc": round(gfa_spend / gfa_clicks) if gfa_clicks > 0 else 0
        }

    except Exception as e:
        logger.error(f"[GFA Collector] Exception during collection: {e}")
        log_event("GFA_COLLECTOR", "ERROR", str(e))
        return {"success": False, "error": str(e)}

    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass
