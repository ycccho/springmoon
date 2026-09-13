@echo off
chcp 65001 > nul
title MKT Scheduler (Immediate Run)
cd /d "%~dp0"

echo [MKT Scheduler] 광고 성과 즉시 수집 및 동기화를 시작합니다...
echo.

python -m mkt_scheduler.main_scheduler --now %1

echo.
echo =================================================================
echo 작업이 완료되었습니다. 창을 닫으려면 아무 키나 누르세요.
echo =================================================================
pause > nul
