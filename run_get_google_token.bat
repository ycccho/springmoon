@echo off
chcp 65001 > nul
title 구글 검색광고 토큰 발급
cd /d "%~dp0"

echo =================================================================
echo [구글 광고 토큰 발급기]
echo 브라우저에서 구글 로그인을 진행하면 토큰이 자동 저장됩니다.
echo =================================================================
echo.

python -m mkt_scheduler.get_google_token

echo.
pause
