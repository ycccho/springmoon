@echo off
title Springmoon Automation Servers
chcp 65001 >nul
echo ==================================================
echo  Springmoon 자동화 통합 서버 기동기 (원클릭 실행)
echo ==================================================
echo.
echo 1. 백스크린샷 캡처 서버 기동 중... (포트 3888)
start "Screenshot Helper Server" cmd /k "node screenshot_server.js"

echo.
echo 2. 로컬 웹 서버 기동 중... (포트 8788)
echo    ※ 최초 실행 시 wrangler 패키지 설치/승인 질문이 나오면 y를 눌러주세요.
start "Local Web Server" cmd /k "npx wrangler pages dev ."

echo.
echo 3. 5초 후 브라우저로 로컬 개발용 주소를 자동 연결합니다...
timeout /t 5 >nul
start http://localhost:8788?menu=keyword-screenshot

echo ==================================================
echo  서버 기동 완료!
echo  작업 종료 시 팝업된 검은색 터미널 창들을 모두 닫아주시면 됩니다.
echo ==================================================
pause
