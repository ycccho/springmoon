import http.server
import urllib.parse
import webbrowser
import requests
import json
import sys
import time
from pathlib import Path

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .config import (
    KAKAO_REST_API_KEY,
    KAKAO_REDIRECT_URI,
    KAKAO_TOKENS_PATH,
    KAKAO_TOKEN_URL
)

DEFAULT_REDIRECT_URI = "http://localhost:5000/oauth"
auth_code = None

class KakaoOAuthHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        global auth_code
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "code" in params:
            auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.send_header("Connection", "close")
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html lang="ko">
            <head><meta charset="utf-8"><title>카카오톡 연동 완료</title></head>
            <body style="font-family: sans-serif; text-align: center; padding-top: 60px; background-color: #FAFAFA;">
                <div style="display: inline-block; background: white; padding: 40px 50px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                    <h2 style="color: #3C1E1E; background-color: #FEE500; display: inline-block; padding: 10px 24px; border-radius: 8px; margin-bottom: 16px;">
                        🎉 카카오톡 로그인 및 메시지 권한 인증 성공!
                    </h2>
                    <p style="color: #444; font-size: 15px; margin-top: 10px;">
                        인증이 정상 완료되었습니다.<br>이 창을 닫고 콘솔 창을 확인하세요.
                    </p>
                </div>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
        else:
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(b"OK")

class ReusableServer(http.server.HTTPServer):
    allow_reuse_address = True

def exchange_kakao_code(code: str, redirect_uri: str) -> bool:
    print("\n[진행중] 인가 코드로 카카오 토큰 서버에서 Refresh Token 발급 중...")
    payload = {
        "grant_type": "authorization_code",
        "client_id": KAKAO_REST_API_KEY,
        "redirect_uri": redirect_uri,
        "code": code
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded;charset=utf-8"}

    try:
        res = requests.post(KAKAO_TOKEN_URL, data=payload, headers=headers, timeout=15)
        if res.status_code == 200:
            token_data = res.json()
            with open(KAKAO_TOKENS_PATH, "w", encoding="utf-8") as f:
                json.dump(token_data, f, indent=2, ensure_ascii=False)

            print("\n" + "=" * 65)
            print("🎉 카카오톡 토큰 발급 및 저장 성공!")
            print(f"저장 파일: {KAKAO_TOKENS_PATH}")
            print(f"Access Token: {token_data.get('access_token')[:20]}...")
            print(f"Refresh Token: {token_data.get('refresh_token')[:20]}...")
            print("=" * 65)
            return True
        else:
            print(f"\n[오류] 토큰 발급 실패 (HTTP {res.status_code}): {res.text}")
            return False
    except Exception as e:
        print(f"\n[오류] 카카오 서버 통신 에러: {e}")
        return False

def main():
    global auth_code
    auth_code = None

    print("=" * 65)
    print(" [카카오톡 나와의 채팅 (Memo API) OAuth2 토큰 발급]")
    print(f" - REST API 키: {KAKAO_REST_API_KEY}")
    print("=" * 65)

    redirect_uri = DEFAULT_REDIRECT_URI
    port = 5000

    auth_url = (
        f"https://kauth.kakao.com/oauth/authorize?"
        f"client_id={KAKAO_REST_API_KEY}&"
        f"redirect_uri={urllib.parse.quote(redirect_uri)}&"
        f"response_type=code&"
        f"scope=talk_message"
    )

    # Start local HTTP server first before opening browser
    server = None
    try:
        server = ReusableServer(("127.0.0.1", port), KakaoOAuthHandler)
        server.timeout = 1.0
        print(f"\n로컬 인증 수신 서버 준비 완료 (포트 {port})")
    except Exception as e:
        print(f"\n[경고] 포트 {port} 서버 바인딩 실패: {e}")

    print("브라우저에서 카카오 로그인 페이지를 엽니다...")
    print(f"URL: {auth_url}\n")
    try:
        webbrowser.open(auth_url)
    except Exception:
        pass

    if server:
        print("💡 브라우저에서 [동의하고 계속하기]를 클릭하시면 자동으로 완료됩니다.")
        print("   (혹시 브라우저 주소창이 http://localhost:5000/oauth?code=... 로 바뀌고 멈춰있다면,")
        print("   주소창의 전체 URL을 복사하여 아래에 붙여넣으셔도 됩니다!)\n")
        print("수신 대기 중... (Ctrl+C로 취소 가능)")

        start_wait = time.time()
        # Wait up to 120 seconds for browser callback
        try:
            while not auth_code and (time.time() - start_wait < 120):
                server.handle_request()
        except KeyboardInterrupt:
            print("\n취소되었습니다.")
        finally:
            try:
                server.server_close()
            except Exception:
                pass

    if auth_code:
        exchange_kakao_code(auth_code, redirect_uri)
    else:
        print("\n" + "-" * 65)
        print("💡 브라우저 주소창에 'http://localhost:5000/oauth?code=...' 주소가 떠 있다면,")
        print("   주소창의 전체 URL(또는 code 값)을 복사해서 아래에 붙여넣어 주세요:")
        print("-" * 65)
        code_input = input("주소 또는 code 입력: ").strip()
        if code_input:
            if "code=" in code_input:
                parsed_qs = urllib.parse.parse_qs(urllib.parse.urlparse(code_input).query)
                code_input = parsed_qs.get("code", [code_input])[0]
            exchange_kakao_code(code_input, redirect_uri)

if __name__ == "__main__":
    main()
