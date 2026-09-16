import http.server
import urllib.parse
import webbrowser
import requests
import json
import sys
from pathlib import Path

# Ensure UTF-8 output
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from .config import (
        CREDENTIALS_PATH,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_TOKENS_PATH,
        GOOGLE_DEVELOPER_TOKEN,
        GOOGLE_CUSTOMER_ID,
        GOOGLE_API_VERSION
    )
except ImportError:
    from mkt_scheduler.config import (
        CREDENTIALS_PATH,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_TOKENS_PATH,
        GOOGLE_DEVELOPER_TOKEN,
        GOOGLE_CUSTOMER_ID,
        GOOGLE_API_VERSION
    )

DEFAULT_REDIRECT_URI = "http://127.0.0.1:8080"
SCOPE = "https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.email openid"

auth_code = None

class OAuthHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        global auth_code
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        if "code" in params:
            auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html lang="ko">
            <head><meta charset="utf-8"><title>구글 광고 인증 완료</title></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding-top: 60px; background: #f8fafc;">
                <div style="display: inline-block; background: white; padding: 40px 50px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
                    <h2 style="color: #10b981; margin-top: 0;">✅ 구글 검색광고 인증 완료!</h2>
                    <p style="color: #475569; font-size: 15px;">인가 코드가 성공적으로 전달되었습니다.<br>이 브라우저 탭을 닫고 콘솔 창을 확인하세요.</p>
                </div>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Authorization code not found.")

def exchange_code_for_tokens(code: str, client_id: str, client_secret: str, redirect_uri: str) -> bool:
    print("\n[진행중] 인가 코드를 구글 서버로 전송하여 Refresh Token 발급 중...")
    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }

    res = requests.post(token_url, data=payload, timeout=15)
    if res.status_code == 200:
        token_data = res.json()
        refresh_token = token_data.get("refresh_token")
        access_token = token_data.get("access_token")

        save_data = {
            "refresh_token": refresh_token,
            "access_token": access_token,
            "updated_at": res.headers.get("Date", "")
        }

        with open(GOOGLE_TOKENS_PATH, "w", encoding="utf-8") as f:
            json.dump(save_data, f, indent=2, ensure_ascii=False)

        print("\n" + "=" * 65)
        print("🎉 구글 Refresh Token 발급 및 저장 완료!")
        print(f"저장 위치: {GOOGLE_TOKENS_PATH}")
        print("=" * 65)

        # 1. Check authenticated user's email
        try:
            u_res = requests.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
            if u_res.status_code == 200:
                user_email = u_res.json().get("email", "알 수 없음")
                print(f"📧 인증된 구글 계정: {user_email}")
        except Exception:
            pass

        # 2. Check accessible Google Ads customers
        print("\n[검증중] 해당 구글 계정에 연결된 구글 광고 계정 목록 확인 중...")
        try:
            acc_url = f"https://googleads.googleapis.com/{GOOGLE_API_VERSION}/customers:listAccessibleCustomers"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "developer-token": GOOGLE_DEVELOPER_TOKEN
            }
            acc_res = requests.get(acc_url, headers=headers, timeout=10)
            if acc_res.status_code == 200:
                c_list = acc_res.json().get("resourceNames", [])
                cids = [c.replace("customers/", "") for c in c_list]
                print(f"📋 접근 가능한 고객 ID ({len(cids)}개): {cids}")

                target = str(GOOGLE_CUSTOMER_ID).replace("-", "").strip()
                if target in cids:
                    print(f"✅ 현재 설정된 고객 ID ({target})와 일치합니다!")
                else:
                    print(f"\n⚠️ 주의: 현재 설정된 고객 ID ({target})가 목록에 없습니다.")
                    print("   구글 광고 관리 권한이 있는 다른 구글 계정으로 로그인하셨거나,")
                    print("   고객 ID 번호가 다른지 확인이 필요합니다.")
            else:
                print(f"   계정 목록 조회 실패 ({acc_res.status_code}): {acc_res.text}")
        except Exception as e:
            print(f"   계정 목록 검증 중 예외 발생: {e}")

        return True
    else:
        print(f"\n[오류] 토큰 교환 실패 (HTTP {res.status_code}): {res.text}")
        return False

def main():
    global auth_code
    auth_code = None

    client_id = GOOGLE_CLIENT_ID
    client_secret = GOOGLE_CLIENT_SECRET

    redirect_uri = "http://127.0.0.1:8080"
    port = 8080

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={urllib.parse.quote(client_id)}&"
        f"redirect_uri={urllib.parse.quote(redirect_uri)}&"
        f"response_type=code&"
        f"scope={urllib.parse.quote(SCOPE)}&"
        f"access_type=offline&"
        f"prompt=consent"
    )

    print("=" * 65)
    print(" [구글 검색광고 OAuth2 인증 시작]")
    print("=" * 65)
    print(f"• 클라이언트 ID: {client_id}")
    print(f"• 고객 ID: {GOOGLE_CUSTOMER_ID}")
    print(f"• 리디렉션 주소: {redirect_uri}")
    print("-" * 65)
    print("⚠️ 중요: 구글 로그인 화면이 뜨면 반드시")
    print("   [구글 검색광고 계정을 관리하는 구글 계정]을 선택해 주세요.")
    print("-" * 65)

    print(f"\n인증 URL: {auth_url}\n")
    try:
        webbrowser.open(auth_url)
        print("🌐 기본 브라우저에서 구글 로그인 창을 자동으로 열었습니다.")
    except Exception:
        print("브라우저 자동 열기 실패. 위 URL을 브라우저에 직접 붙여넣어 접속하세요.")

    print(f"\n로컬 인증 대기 서버 가동 중 (127.0.0.1:{port})...")
    print("(브라우저에서 계정 선택 및 [계속 / 허용]을 완료하면 자동으로 감지됩니다.)")

    try:
        server = http.server.HTTPServer(("127.0.0.1", port), OAuthHandler)
        server.handle_request()
    except Exception as e:
        print(f"\n[오류] 로컬 서버 오류: {e}")
        return

    if auth_code:
        exchange_code_for_tokens(auth_code, client_id, client_secret, redirect_uri)
    else:
        print("\n[오류] 인가 코드를 수신하지 못했습니다.")

if __name__ == "__main__":
    main()
