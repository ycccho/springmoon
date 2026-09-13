@echo off
chcp 65001 > nul
cd /d "%~dp0"
python -m mkt_scheduler.get_kakao_token
echo.
pause
