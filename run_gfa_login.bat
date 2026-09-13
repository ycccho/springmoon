@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo =================================================================
echo 🚀 GFA (네이버 성과형 디스플레이 광고) 로그인 브라우저 시작
echo =================================================================
echo 1. 잠시 후 열리는 크롬 창에서 [네이버 로그인]을 진행해 주세요.
echo    (★ 반드시 '로그인 상태 유지'에 체크해 주세요)
echo.
echo 2. 로그인 후 광고계정 목록에서 [inde_company:naver]를 확인하고,
echo    우측의 [운영 관리] 버튼을 클릭해 주세요.
echo.
echo 3. 대시보드(인지도 및 트래픽 ^> 네이티브 캠페인) 화면이 열리면 완료입니다.
echo.
echo 4. 작업이 끝나면 크롬 창을 닫으신 후, 이 창에서 아무 키나 눌러주세요.
echo =================================================================
echo.

set CHROME_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe
if not exist "%CHROME_BIN%" set CHROME_BIN=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
if not exist "%CHROME_BIN%" (
    echo [오류] 크롬 브라우저를 찾을 수 없습니다.
    pause
    exit /b 1
)

start "" "%CHROME_BIN%" --user-data-dir="%~dp0mkt_scheduler\gfa_profile" --no-first-run --no-default-browser-check "https://gfa.naver.com"

echo 브라우저가 열렸습니다. 로그인을 완료하신 뒤 창을 닫고 아래 키를 누르세요.
echo.
pause
