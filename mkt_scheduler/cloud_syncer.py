import json
import logging
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

    # 1. Update local static JSON file
    try:
        with open(STATIC_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        logger.info(f"[Cloud Syncer] Updated local file: {STATIC_JSON_PATH}")
    except Exception as e:
        logger.error(f"[Cloud Syncer] Failed to write local JSON file: {e}")

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
