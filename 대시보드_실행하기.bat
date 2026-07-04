@echo off
title Naver Ad Dashboard Launcher
echo ====================================================
echo  Starting Naver Ad Dashboard automatic runner...
echo ====================================================
echo.

:: 1. Diagnostic Python installation check
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Python is not installed or not added to system PATH.
    echo.
    echo [How to Fix]
    echo 1. Go to: https://www.python.org/downloads/
    echo 2. Download and run the installer.
    echo 3. IMPORTANT: Make sure to check [Add python.exe to PATH] at the bottom before installing!
    echo 4. Restart this batch file.
    echo.
    pause
    exit
)

echo [1/2] Installing required Python libraries...
python -m pip install --upgrade pip
python -m pip install streamlit pandas plotly requests openpyxl
echo.

echo [2/2] Booting Streamlit dashboard server...
echo (Keep this window open while using the dashboard)
echo.
python -m streamlit run naver_ad_dashboard/app.py
echo.
pause
