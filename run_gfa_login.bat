@echo off
cd /d "%~dp0"
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%~dp0mkt_scheduler\gfa_profile" --no-first-run --no-default-browser-check "https://gfa.naver.com"
echo [OK] Chrome browser is opening now...
echo.
echo 1. Log in to Naver (Check 'Keep logged in')
echo 2. Select 'inde_company:naver' and click [Manage]
echo 3. Go to [Awareness and Traffic] - [Native] campaign
echo.
echo When finished, close Chrome and press any key to exit this window.
pause > nul
