@echo off
chcp 65001 >nul
title 네이버 검색광고 대시보드 가동기

echo ====================================================
echo  네이버 검색광고 대시보드 자동 가동기를 시작합니다.
echo ====================================================
echo.

:: 1. 파이썬 설치 여부 자가진단
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ [오류] 컴퓨터에 Python(파이썬)이 설치되어 있지 않거나 환경 변수(PATH)에 등록되지 않았습니다.
    echo.
    echo [초간단 해결 방법]
    echo 1. 인터넷 창에 아래 주소로 접속해 설치 파일을 다운로드합니다:
    echo    https://www.python.org/downloads/
    echo 2. 설치 창이 뜨면 **맨 밑에 있는 [Add python.exe to PATH]** 체크박스를 반드시 체크하고 설치(Install Now)해 주세요.
    echo 3. 설치가 끝나면 이 검은색 창을 닫고, 대시보드_실행하기.bat 파일을 다시 더블클릭해 주세요.
    echo.
    pause
    exit
)

echo [1/2] 필수 파이썬 라이브러리 자동 설치 및 검사 중...
python -m pip install --upgrade pip
python -m pip install streamlit pandas plotly requests openpyxl
echo.

echo [2/2] 대시보드 웹 서버 실행 중...
echo (이 검은색 창을 닫으면 대시보드가 종료되므로 사용하시는 동안 그대로 켜두세요.)
echo.
python -m streamlit run naver_ad_dashboard/app.py
echo.
pause
