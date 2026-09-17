import time
import json
import logging
from pathlib import Path
import jwt
import requests

from .config import (
    NAVERWORKS_CLIENT_ID,
    NAVERWORKS_CLIENT_SECRET,
    NAVERWORKS_SERVICE_ACCOUNT,
    NAVERWORKS_PRIVATE_KEY_PATH,
    NAVERWORKS_BOT_ID,
    NAVERWORKS_USER_ID,
    NAVERWORKS_CHANNEL_ID,
    NAVERWORKS_TOKEN_URL,
    NAVERWORKS_API_BASE_URL
)
from .db_manager import log_event

logger = logging.getLogger(__name__)

_cached_token = None
_token_expires_at = 0

def get_naverworks_access_token() -> str:
    """
    Generates an Access Token via JWT (RS256) service account authentication.
    Caches the token for ~55 minutes.
    """
    global _cached_token, _token_expires_at
    now = int(time.time())

    if _cached_token and now < _token_expires_at:
        return _cached_token

    if not NAVERWORKS_PRIVATE_KEY_PATH.exists():
        logger.error(f"[NaverWorks] Private key file not found at {NAVERWORKS_PRIVATE_KEY_PATH}")
        log_event("NAVERWORKS_AUTH", "ERROR", "Private key missing")
        return ""

    try:
        with open(NAVERWORKS_PRIVATE_KEY_PATH, "r", encoding="utf-8") as f:
            private_key = f.read()

        payload = {
            "iss": NAVERWORKS_CLIENT_ID,
            "sub": NAVERWORKS_SERVICE_ACCOUNT,
            "iat": now,
            "exp": now + 3600
        }

        assertion = jwt.encode(payload, private_key, algorithm="RS256")

        headers = {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"}
        params = {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "client_id": NAVERWORKS_CLIENT_ID,
            "client_secret": NAVERWORKS_CLIENT_SECRET,
            "assertion": assertion,
            "scope": "bot bot.message"
        }

        res = requests.post(NAVERWORKS_TOKEN_URL, headers=headers, data=params, timeout=10)
        if res.status_code == 200:
            data = res.json()
            _cached_token = data.get("access_token")
            expires_in = int(data.get("expires_in", 3600))
            _token_expires_at = now + expires_in - 120
            return _cached_token
        else:
            logger.error(f"[NaverWorks] Token generation failed ({res.status_code}): {res.text}")
            log_event("NAVERWORKS_AUTH", "ERROR", f"Token error: {res.text}")
            return ""
    except Exception as e:
        logger.error(f"[NaverWorks] Exception generating token: {e}")
        log_event("NAVERWORKS_AUTH", "ERROR", str(e))
        return ""

def send_naverworks_message(message_text: str, channel_id: str = None) -> bool:
    """
    Sends a message via Naver Works Bot API.
    Defaults to the configured group channel (유료광고 데이터 기록방).
    If channel_id is not provided and no default channel is set, falls back to 1:1 user message.
    """
    access_token = get_naverworks_access_token()
    if not access_token:
        logger.warning("[NaverWorks] Skipping message dispatch (No access token).")
        log_event("NAVERWORKS_SEND", "SKIPPED", "No access token")
        return False

    target_channel = channel_id or NAVERWORKS_CHANNEL_ID

    if target_channel:
        send_url = f"{NAVERWORKS_API_BASE_URL}/bots/{NAVERWORKS_BOT_ID}/channels/{target_channel}/messages"
        dest_label = f"Channel {target_channel}"
    elif NAVERWORKS_USER_ID:
        send_url = f"{NAVERWORKS_API_BASE_URL}/bots/{NAVERWORKS_BOT_ID}/users/{NAVERWORKS_USER_ID}/messages"
        dest_label = f"User {NAVERWORKS_USER_ID}"
    else:
        logger.error("[NaverWorks] Neither channel_id nor user_id is configured.")
        return False

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    body = {
        "content": {
            "type": "text",
            "text": message_text
        }
    }

    try:
        res = requests.post(send_url, headers=headers, json=body, timeout=15)
        if res.status_code in [200, 201]:
            logger.info(f"[NaverWorks] Message successfully sent to {dest_label}")
            log_event("NAVERWORKS_SEND", "SUCCESS", f"Delivered to {dest_label}")
            return True
        else:
            logger.error(f"[NaverWorks] Send failed ({res.status_code}): {res.text}")
            log_event("NAVERWORKS_SEND", "ERROR", f"Status {res.status_code}: {res.text}")
            return False
    except Exception as e:
        logger.error(f"[NaverWorks] Exception sending message: {e}")
        log_event("NAVERWORKS_SEND", "ERROR", str(e))
        return False
