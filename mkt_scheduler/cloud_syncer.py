import json
import logging
import re
from datetime import datetime
import requests

from .config import CF_SYNC_URL, CF_SYNC_KEY, STATIC_JSON_PATH
from .db_manager import build_export_json, log_event

logger = logging.getLogger(__name__)

def sync_to_cloud() -> dict:
    """
    Compiles local SQLite data, updates local mkt_data.json,
    and pushes to Cloudflare Pages API (/api/mkt) to update Cloudflare KV.
    """
    logger.info("[Cloud Syncer] Compiling export payload from SQLite...")
    payload = build_export_json()

    # 1. Update local static JSON file & embedded snapshot in mkt.html
    try:
        with open(STATIC_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        logger.info(f"[Cloud Syncer] Updated local file: {STATIC_JSON_PATH}")
    except Exception as e:
        logger.error(f"[Cloud Syncer] Failed to write local JSON file: {e}")

    try:
        html_path = STATIC_JSON_PATH.parent / "mkt.html"
        if html_path.exists():
            with open(html_path, "r", encoding="utf-8") as f:
                html_content = f.read()
            json_str = json.dumps(payload, indent=2, ensure_ascii=False)
            pattern = r'const EMBEDDED_MKT_DATA = \{[\s\S]*?\};\s*let marketingData = EMBEDDED_MKT_DATA;'
            replacement = f'const EMBEDDED_MKT_DATA = {json_str};\n    let marketingData = EMBEDDED_MKT_DATA;'
            new_html, count = re.subn(pattern, replacement, html_content)
            if count == 1:
                with open(html_path, "w", encoding="utf-8") as f:
                    f.write(new_html)
                logger.info(f"[Cloud Syncer] Updated embedded snapshot in {html_path}")
    except Exception as e:
        logger.warning(f"[Cloud Syncer] Could not update embedded snapshot in mkt.html: {e}")

    # 2. Push to Cloudflare Pages Functions KV API
    headers = {
        "Content-Type": "application/json",
        "X-Sync-Key": CF_SYNC_KEY
    }

    try:
        logger.info(f"[Cloud Syncer] Sending payload to {CF_SYNC_URL}...")
        res = requests.post(CF_SYNC_URL, headers=headers, json=payload, timeout=20)
        if res.status_code == 200:
            resp_data = res.json()
            log_event("CLOUD_SYNC", "SUCCESS", f"Synced to {CF_SYNC_URL}: {resp_data.get('message')}")
            logger.info("[Cloud Syncer] Cloudflare KV sync completed successfully!")
            return {
                "success": True,
                "status_code": 200,
                "message": "Cloud sync successful",
                "days_count": len(payload.get("daily", {})),
                "keywords_count": len(payload.get("keywords", []))
            }
        else:
            msg = f"Cloudflare API returned HTTP {res.status_code}: {res.text}"
            logger.warning(f"[Cloud Syncer] {msg}")
            log_event("CLOUD_SYNC", "WARNING", msg)
            return {
                "success": False,
                "status_code": res.status_code,
                "error": msg
            }
    except Exception as e:
        msg = f"Exception during Cloudflare sync: {e}"
        logger.warning(f"[Cloud Syncer] {msg}")
        log_event("CLOUD_SYNC", "WARNING", msg)
        return {
            "success": False,
            "error": msg
        }

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = sync_to_cloud()
    print("Sync result:", result)
