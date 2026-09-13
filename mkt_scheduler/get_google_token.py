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
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_TOKENS_PATH
)

DEFAULT_REDIRECT_URI = "http://localhost:8080"
SCOPE = "https://www.googleapis.com/auth/adwords"

auth_code = None

class OAuthHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress noisy HTTP server logs
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

def exchange_code_for_tokens(code: str, redirect_uri: str) -> bool:
    print("\n[진행중] 인가 코드를 구글 서버로 전송하여 Refresh Token 발급 중...")
    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
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

def verify_and_save_refresh_token(refresh_token: str) -> bool:
    print("\n[검증중] 입력하신 Refresh Token의 유효성을 구글 서버에서 확인 중...")
    res = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
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
    print("=" * 65)
    print(" [구글 검색광고 OAuth2 Refresh Token 발급 & 등록 마법사]")
    print(f" - 클라이언트 ID: {GOOGLE_CLIENT_ID[:25]}...")
    print("=" * 65)
    print("\n어떤 방법으로 진행하시겠습니까?")
    print("  [1] 브라우저 자동 로그인 시도 (기본값: http://localhost:8080)")
    print("  [2] 다른 Redirect URI로 로그인 시도 (예: http://localhost:8080/, http://127.0.0.1:8080)")
    print("  [3] 발급받은 Refresh Token 직접 입력하기 (가장 빠름)")
    print("  [4] 구글 리디렉션 URI 불일치(redirect_uri_mismatch) 해결 가이드 보기")
    
    choice = input("\n선택 번호를 입력하세요 (1~4, 기본값 1): ").strip()
    if not choice:
        choice = "1"

    if choice == "3":
        token_input = input("\n구글 Refresh Token을 붙여넣으세요: ").strip()
        if token_input:
            verify_and_save_refresh_token(token_input)
        return

    if choice == "4":
        print("\n" + "-" * 65)
        print("💡 [redirect_uri_mismatch 400 에러 해결 방법]")
        print("1. 구글 클라우드 콘솔 접속:")
        print("   https://console.cloud.google.com/apis/credentials")
        print("2. 'OAuth 2.0 클라이언트 ID' 목록에서 본인 앱 클릭")
        print("3. '승인된 리디렉션 URI' 섹션에 다음 주소들을 추가하고 [저장] 클릭:")
        print("   - http://localhost:8080")
        print("   - http://localhost:8080/")
        print("   - http://127.0.0.1:8080")
        print("4. 저장 후 1번을 선택하여 다시 로그인을 시도하시면 즉시 성공합니다!")
        print("-" * 65)
        input("\n확인하셨으면 엔터를 누르세요...")
        return

    redirect_uri = DEFAULT_REDIRECT_URI
    port = 8080

    if choice == "2":
        uri_input = input(f"\n사용할 Redirect URI를 입력하세요 (기본값: {DEFAULT_REDIRECT_URI}): ").strip()
        if uri_input:
            redirect_uri = uri_input
            parsed = urllib.parse.urlparse(redirect_uri)
            if parsed.port:
                port = parsed.port

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={urllib.parse.quote(redirect_uri)}&"
        f"response_type=code&"
        f"scope={urllib.parse.quote(SCOPE)}&"
        f"access_type=offline&"
        f"prompt=consent"
    )

    print(f"\n브라우저에서 구글 로그인 페이지를 엽니다...")
    print(f"Redirect URI: {redirect_uri}")
    print(f"인증 URL: {auth_url}\n")
    try:
        webbrowser.open(auth_url)
    except Exception:
        print("브라우저 자동 열기 실패. 위 URL을 브라우저에 직접 붙여넣어 접속하세요.")

    print(f"로컬 인증 서버 대기 중 (포트: {port})...")
    try:
        server = http.server.HTTPServer(("0.0.0.0", port), OAuthHandler)
        server.handle_request()
    except Exception as e:
        print(f"\n[오류] 로컬 서버 시작 실패: {e}")
        code_input = input("\n로그인 후 브라우저 주소창에 나타난 'code=...' 값을 직접 입력하세요: ").strip()
        if code_input:
            if "code=" in code_input:
                code_input = urllib.parse.parse_qs(urllib.parse.urlparse(code_input).query).get("code", [code_input])[0]
            exchange_code_for_tokens(code_input, redirect_uri)
        return

    if auth_code:
        exchange_code_for_tokens(auth_code, redirect_uri)
    else:
        print("\n[오류] 인가 코드를 수신하지 못했습니다.")
        code_input = input("로그인 후 브라우저 주소창의 전체 URL 또는 code 값을 붙여넣으세요: ").strip()
        if code_input:
            if "code=" in code_input:
                parsed_qs = urllib.parse.parse_qs(urllib.parse.urlparse(code_input).query)
                code_input = parsed_qs.get("code", [code_input])[0]
            exchange_code_for_tokens(code_input, redirect_uri)

if __name__ == "__main__":
    main()
