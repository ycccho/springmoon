import os
import json
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DB_PATH = BASE_DIR / "mkt_data.sqlite3"
STATIC_JSON_PATH = PROJECT_ROOT / "mkt_data.json"
CREDENTIALS_PATH = BASE_DIR / "credentials.json"
KAKAO_TOKENS_PATH = BASE_DIR / "kakao_tokens.json"
GOOGLE_TOKENS_PATH = BASE_DIR / "google_tokens.json"

# Dashboard URL
DASHBOARD_URL = "https://springmoons.pages.dev/mkt"

# Load credentials from local credentials.json
_creds = {}
if CREDENTIALS_PATH.exists():
    try:
        with open(CREDENTIALS_PATH, "r", encoding="utf-8") as f:
            _creds = json.load(f)
    except Exception:
        pass

# Cloudflare Pages Sync API
CF_SYNC_URL = _creds.get("cloudflare", {}).get("sync_url", "https://springmoons.pages.dev/api/mkt")
CF_SYNC_KEY = _creds.get("cloudflare", {}).get("sync_key", "springmoon-mkt-sync-2026")

# Naver Search Ads Credentials
_naver = _creds.get("naver", {})
NAVER_BASE_URL = "https://api.searchad.naver.com"
NAVER_API_KEY = _naver.get("api_key", "")
NAVER_SECRET_KEY = _naver.get("secret_key", "")
NAVER_CUSTOMER_ID = _naver.get("customer_id", "1610516")

# Google Ads API Credentials
_google = _creds.get("google", {})
GOOGLE_DEVELOPER_TOKEN = _google.get("developer_token", "")
GOOGLE_CLIENT_ID = _google.get("client_id", "")
GOOGLE_CLIENT_SECRET = _google.get("client_secret", "")
GOOGLE_CUSTOMER_ID = _google.get("customer_id", "8086966013")
GOOGLE_API_VERSION = "v22"

# KakaoTalk Memo API Credentials
_kakao = _creds.get("kakao", {})
KAKAO_REST_API_KEY = _kakao.get("rest_api_key", "")
KAKAO_REDIRECT_URI = _kakao.get("redirect_uri", "http://localhost:5000/oauth")
KAKAO_MEMO_SEND_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send"
KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
