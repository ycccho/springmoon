@echo off
chcp 65001 > nul
cd /d "%~dp0"
:loop
python -m mkt_scheduler.main_scheduler
echo.
echo [Warning] Scheduler stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak > nul
goto loop
