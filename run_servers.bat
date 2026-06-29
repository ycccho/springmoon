@echo off
title Springmoon Automation Server
chcp 65001 >nul
echo ==================================================
echo  Springmoon 자동화 통합 서버 기동기 (원클릭 실행)
echo ==================================================
echo.
echo 1. 통합 서버 기동 중... (포트 3888)
start "Springmoon Server" cmd /k "node screenshot_server.js"

echo.
echo 2. 3초 후 브라우저로 접속용 로컬 주소를 자동 연결합니다...
timeout /t 3 >nul
start http://127.0.0.1:3888?menu=keyword-screenshot

echo ==================================================
echo  서버 기동 완료!
echo  작업 종료 시 팝업된 검은색 터미널 창을 닫아주시면 됩니다.
echo ==================================================
pause
