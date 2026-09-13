@echo off
chcp 65001 > nul
cd /d "%~dp0"
python -m mkt_scheduler.gfa_login
echo.
pause
