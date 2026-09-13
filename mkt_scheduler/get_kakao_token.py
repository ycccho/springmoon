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
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html lang="ko">
            <head><meta charset="utf-8"><title>카카오톡 연동 완료</title></head>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h2 style="color: #3C1E1E; background-color: #FEE500; display: inline-block; padding: 12px 24px; border-radius: 10px;">
                    ✅ 카카오톡 로그인 및 메시지 권한 인증 성공!
                </h2>
                <p style="margin-top: 20px; color: #555;">브라우저 창을 닫고 콘솔 창을 확인하세요.</p>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Authorization code was not found in callback.")

def exchange_kakao_code(code: str, redirect_uri: str) -> bool:
    print("\n[진행중] 인가 코드로 카카오 토큰 서버에서 토큰 발급 중...")
    payload = {
        "grant_type": "authorization_code",
        "client_id": KAKAO_REST_API_KEY,
        "redirect_uri": redirect_uri,
        "code": code
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded;charset=utf-8"}

    res = requests.post(KAKAO_TOKEN_URL, data=payload, headers=headers)
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

def verify_and_save_kakao_refresh_token(refresh_token: str) -> bool:
    print("\n[검증중] 입력하신 카카오 Refresh Token 유효성 검증 중...")
    payload = {
        "grant_type": "refresh_token",
        "client_id": KAKAO_REST_API_KEY,
        "refresh_token": refresh_token.strip()
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded;charset=utf-8"}

    res = requests.post(KAKAO_TOKEN_URL, data=payload, headers=headers)
    if res.status_code == 200:
        token_data = res.json()
        token_data["refresh_token"] = refresh_token.strip()
        with open(KAKAO_TOKENS_PATH, "w", encoding="utf-8") as f:
            json.dump(token_data, f, indent=2, ensure_ascii=False)
        print("\n" + "=" * 65)
        print("🎉 유효한 카카오 Refresh Token이 확인 및 저장되었습니다!")
        print(f"저장 파일: {KAKAO_TOKENS_PATH}")
        print("=" * 65)
        return True
    else:
        print(f"\n[오류] 토큰 검증 실패 (HTTP {res.status_code}): {res.text}")
        return False

def main():
    print("=" * 65)
    print(" [카카오톡 나와의 채팅 (Memo API) OAuth2 토큰 발급 마법사]")
    print(f" - REST API 키: {KAKAO_REST_API_KEY}")
    print("=" * 65)
    print("\n어떤 방법으로 진행하시겠습니까?")
    print("  [1] 브라우저 자동 로그인 시도 (기본값: http://localhost:5000/oauth)")
    print("  [2] 카카오 콘솔에 등록된 다른 Redirect URI로 로그인 시도")
    print("  [3] 발급받은 Refresh Token 직접 입력하기")
    print("  [4] KOE205 에러 해결 방법 보기 (1분 설정 가이드)")

    choice = input("\n선택 번호를 입력하세요 (1~4, 기본값 1): ").strip()
    if not choice:
        choice = "1"

    if choice == "3":
        token_input = input("\n카카오 Refresh Token을 입력하세요: ").strip()
        if token_input:
            verify_and_save_kakao_refresh_token(token_input)
        return

    if choice == "4":
        print("\n" + "-" * 65)
        print("💡 [카카오 KOE205 에러 초간단 해결 방법 (1분 소요)]")
        print("1. 카카오 디벨로퍼스 콘솔 접속:")
        print("   https://developers.kakao.com/console/app")
        print("2. 내 애플리케이션 목록에서 '인디 광고알림' 클릭")
        print("3. 좌측 메뉴 [카카오 로그인] 클릭:")
        print("   ① '활성화 설정' 상태를 [ON]으로 켭니다. (가장 중요!)")
        print("   ② 하단 'Redirect URI 등록' 버튼 클릭 후 아래 주소를 입력하고 [저장]:")
        print("      http://localhost:5000/oauth")
        print("4. 좌측 메뉴 [카카오 로그인] > [동의항목] 클릭:")
        print("   - '카카오톡 메시지 전송 (나에게 보내기)' 항목을 [이용 중 동의]로 설정")
        print("5. 위 설정 후 1번을 선택하시면 브라우저에서 즉시 로그인 동의창이 뜹니다!")
        print("-" * 65)
        input("\n확인하셨으면 엔터를 누르세요...")
        return

    redirect_uri = DEFAULT_REDIRECT_URI
    port = 5000

    if choice == "2":
        uri_input = input(f"\n카카오 콘솔에 등록된 Redirect URI를 입력하세요: ").strip()
        if uri_input:
            redirect_uri = uri_input
            parsed = urllib.parse.urlparse(redirect_uri)
            if parsed.port:
                port = parsed.port

    auth_url = (
        f"https://kauth.kakao.com/oauth/authorize?"
        f"client_id={KAKAO_REST_API_KEY}&"
        f"redirect_uri={urllib.parse.quote(redirect_uri)}&"
        f"response_type=code&"
        f"scope=talk_message"
    )

    print(f"\n카카오 로그인 페이지를 엽니다...")
    print(f"Redirect URI: {redirect_uri}")
    print(f"인증 URL: {auth_url}\n")
    try:
        webbrowser.open(auth_url)
    except Exception:
        print("브라우저 자동 열기 실패. 위 URL을 브라우저에 직접 붙여넣어 접속하세요.")

    print(f"로컬 인증 콜백 수신 서버 대기 중 (포트: {port})...")
    try:
        server = http.server.HTTPServer(("0.0.0.0", port), KakaoOAuthHandler)
        server.handle_request()
    except Exception as e:
        print(f"\n[오류] 로컬 서버 시작 실패: {e}")
        code_input = input("\n로그인 후 브라우저 주소창에 나타난 'code=...' 값을 직접 입력하세요: ").strip()
        if code_input:
            if "code=" in code_input:
                code_input = urllib.parse.parse_qs(urllib.parse.urlparse(code_input).query).get("code", [code_input])[0]
            exchange_kakao_code(code_input, redirect_uri)
        return

    if auth_code:
        exchange_kakao_code(auth_code, redirect_uri)
    else:
        print("\n[오류] 인가 코드를 수신하지 못했습니다.")
        code_input = input("로그인 후 브라우저 주소창의 전체 URL 또는 code 값을 붙여넣으세요: ").strip()
        if code_input:
            if "code=" in code_input:
                code_input = urllib.parse.parse_qs(urllib.parse.urlparse(code_input).query).get("code", [code_input])[0]
            exchange_kakao_code(code_input, redirect_uri)

if __name__ == "__main__":
    main()
