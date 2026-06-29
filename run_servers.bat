@echo off
title Springmoon Unified Server
echo Starting Springmoon Server...
start "Springmoon Server" cmd /k "node screenshot_server.js"
timeout /t 3 >nul
start http://127.0.0.1:3888/?menu=keyword-screenshot
