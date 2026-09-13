import http.server
import urllib.parse
import webbrowser
import requests
import json
import sys
from pathlib import Path

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .config import (
    CREDENTIALS_PATH,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_TOKENS_PATH
)

# For Google Desktop Clients, loopback IP (http://127.0.0.1:8080) is officially supported
# without registering any redirect URI in Google Cloud Console!
DEFAULT_REDIRECT_URI = "http://127.0.0.1:8080"
SCOPE = "https://www.googleapis.com/auth/adwords"

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
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h2 style="color: #10b981;">✅ 구글 광고 계정 인증 성공!</h2>
                <p>브라우저 창을 닫고 콘솔 창을 확인하세요.</p>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Authorization code not found.")

def update_credentials_file(client_id: str, client_secret: str):
    try:
        data = {}
        if CREDENTIALS_PATH.exists():
            with open(CREDENTIALS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
        if "google" not in data:
            data["google"] = {}
        data["google"]["client_id"] = client_id
        data["google"]["client_secret"] = client_secret
        with open(CREDENTIALS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[경고] credentials.json 저장 오류: {e}")

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

    res = requests.post(token_url, data=payload)
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
        print(f"저장 파일: {GOOGLE_TOKENS_PATH}")
        print(f"Refresh Token: {refresh_token}")
        print("=" * 65)
        return True
    else:
        print(f"\n[오류] 토큰 교환 실패 (HTTP {res.status_code}): {res.text}")
        return False

def verify_and_save_refresh_token(refresh_token: str, client_id: str, client_secret: str) -> bool:
    print("\n[검증중] 입력하신 Refresh Token의 유효성을 구글 서버에서 확인 중...")
    res = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token.strip(),
        "grant_type": "refresh_token"
    })
    if res.status_code == 200:
        data = res.json()
        save_data = {
            "refresh_token": refresh_token.strip(),
            "access_token": data.get("access_token"),
            "updated_at": res.headers.get("Date", "")
        }
        with open(GOOGLE_TOKENS_PATH, "w", encoding="utf-8") as f:
            json.dump(save_data, f, indent=2, ensure_ascii=False)
        print("\n" + "=" * 65)
        print("🎉 유효한 구글 Refresh Token이 정상 확인 및 저장되었습니다!")
        print(f"저장 파일: {GOOGLE_TOKENS_PATH}")
        print("=" * 65)
        return True
    else:
        print(f"\n[오류] 유효하지 않은 Refresh Token입니다 ({res.status_code}): {res.text}")
        return False

def main():
    global auth_code
    auth_code = None

    print("=" * 65)
    print(" [구글 검색광고 데스크톱 OAuth2 Refresh Token 발급기]")
    print("=" * 65)

    # Load currently configured client ID and secret
    client_id = GOOGLE_CLIENT_ID
    client_secret = GOOGLE_CLIENT_SECRET

    # If the user has the new desktop client from console screenshot:
    screenshot_client_id = "844149672380-i482fp0tqp2t2a1kkke8525jj3di5i6m.apps.googleusercontent.com"
    if screenshot_client_id not in client_id:
        print(f"\n💡 구글 콘솔 화면의 '데스크톱 클라이언트 1'을 사용하시겠습니까?")
        print(f"   [1] 네, 콘솔의 데스크톱 클라이언트 사용 ({screenshot_client_id[:25]}...)")
        print(f"   [2] 아니오, 기존 설정된 클라이언트 사용 ({client_id[:25]}...)")
        use_ds = input("   선택 (1 또는 2, 기본값 1): ").strip()
        if use_ds != "2":
            client_id = screenshot_client_id
            print("\n구글 콘솔 화면에서 [클라이언트 보안 비밀번호] 아래의 '+ Add secret'을 클릭하거나")
            print("생성된 보안 비밀번호를 복사하여 아래에 붙여넣어 주세요.")
            sec_input = input("클라이언트 보안 비밀번호 입력: ").strip()
            if sec_input:
                client_secret = sec_input
                update_credentials_file(client_id, client_secret)

    print("\n" + "-" * 65)
    print(f"▶ 대상 클라이언트 ID: {client_id}")
    print("▶ 데스크톱 앱 리디렉션 주소: http://127.0.0.1:8080")
    print("-" * 65)
    print("\n브라우저에서 구글 로그인 및 권한 승인 창을 엽니다...")
    print("(브라우저에서 계정을 선택하고 [계속]을 누르시면 자동으로 토큰이 저장됩니다.)\n")

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

    print(f"\n브라우저에서 구글 로그인 페이지를 엽니다...")
    print(f"URL: {auth_url}\n")
    try:
        webbrowser.open(auth_url)
    except Exception:
        print("브라우저 자동 열기 실패. 위 URL을 브라우저에 직접 붙여넣어 접속하세요.")

    print(f"로컬 인증 서버 대기 중 (127.0.0.1:{port})...")
    try:
        server = http.server.HTTPServer(("127.0.0.1", port), OAuthHandler)
        server.handle_request()
    except Exception as e:
        print(f"\n[오류] 로컬 서버 시작 실패: {e}")
        code_input = input("\n로그인 후 주소창의 code 값을 입력하세요: ").strip()
        if code_input:
            if "code=" in code_input:
                code_input = urllib.parse.parse_qs(urllib.parse.urlparse(code_input).query).get("code", [code_input])[0]
            exchange_code_for_tokens(code_input, client_id, client_secret, redirect_uri)
        return

    if auth_code:
        exchange_code_for_tokens(auth_code, client_id, client_secret, redirect_uri)
    else:
        print("\n[오류] 인가 코드를 수신하지 못했습니다.")
        code_input = input("로그인 후 브라우저 주소창의 전체 URL 또는 code 값을 붙여넣으세요: ").strip()
        if code_input:
            if "code=" in code_input:
                code_input = urllib.parse.parse_qs(urllib.parse.urlparse(code_input).query).get("code", [code_input])[0]
            exchange_code_for_tokens(code_input, client_id, client_secret, redirect_uri)

if __name__ == "__main__":
    main()
