@echo off
chcp 65001 > nul
title MKT Scheduler (24/7 Background Runner)
cd /d "%~dp0"

echo =================================================================
echo   [MKT Scheduler] 광고 성과 24시간 무중단 자동 수집 스케줄러
echo   - 매일 오전 09:00: 전일 데이터 수집, 홈페이지 갱신, 카카오톡 발송
echo   - 매주 월요일 09:00: 주간 종합 성과 리포트 발송
echo   - 매월 1일 09:00: 월간 종합 성과 리포트 발송
echo =================================================================
echo.

python -m mkt_scheduler.main_scheduler

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [경고] 스케줄러가 비정상 종료되었습니다. 5초 후 재시작합니다...
    timeout /t 5 /nobreak > nul
    goto :start
)

pause
