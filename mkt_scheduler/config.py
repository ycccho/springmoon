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
KAKAO_CLIENT_SECRET = _kakao.get("client_secret", "")
KAKAO_REDIRECT_URI = _kakao.get("redirect_uri", "http://localhost:5000/oauth")
KAKAO_MEMO_SEND_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send"
KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"

# Naver Works Bot API Credentials
_nw = _creds.get("naverworks", {})
NAVERWORKS_DOMAIN_ID = _nw.get("domain_id", "")
NAVERWORKS_CLIENT_ID = _nw.get("client_id", "")
NAVERWORKS_CLIENT_SECRET = _nw.get("client_secret", "")
NAVERWORKS_SERVICE_ACCOUNT = _nw.get("service_account", "")
NAVERWORKS_PRIVATE_KEY_PATH = BASE_DIR / _nw.get("private_key_file", "naverworks_private.key")
NAVERWORKS_BOT_ID = _nw.get("bot_id", "")
NAVERWORKS_USER_ID = _nw.get("user_id", "")
NAVERWORKS_CHANNEL_ID = _nw.get("channel_id", "")
NAVERWORKS_TOKEN_URL = "https://auth.worksmobile.com/oauth2/v2.0/token"
NAVERWORKS_API_BASE_URL = "https://www.worksapis.com/v1.0"

# Meta Marketing API Credentials
_meta = _creds.get("meta", {})
META_APP_ID = _meta.get("app_id", "")
META_APP_SECRET = _meta.get("app_secret", "")
META_AD_ACCOUNT_ID = _meta.get("ad_account_id", "")
META_ACCESS_TOKEN = _meta.get("access_token", "")
META_API_VERSION = "v20.0"
