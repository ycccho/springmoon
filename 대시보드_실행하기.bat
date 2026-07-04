@echo off
title 네이버 검색광고 대시보드 가동기
echo ====================================================
echo  네이버 검색광고 대시보드 자동 가동기를 시작합니다.
echo ====================================================
echo.
echo [1/2] 필수 파이썬 라이브러리 자동 설치 중...
python -m pip install --upgrade pip
pip install streamlit pandas plotly requests openpyxl
echo.
echo [2/2] 대시보드 웹 서버 실행 중...
echo (이 검은색 창을 닫으면 대시보드가 종료되므로 사용하시는 동안 그대로 켜두세요.)
echo.
streamlit run naver_ad_dashboard/app.py
echo.
pause
