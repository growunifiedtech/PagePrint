@echo off
title PagePrint Desktop Agent
echo ========================================================
echo        Starting PagePrint Desktop Background Agent
echo ========================================================
cd /d "%~dp0"
if exist "PagePrint.exe" (
    start "" "PagePrint.exe"
    echo [OK] PagePrint Agent is now running in the background.
    echo Check your dashboard at https://pageprint.in/dashboard
    timeout /t 3 >nul
    exit
) else (
    echo [ERROR] PagePrint.exe not found in this directory!
    echo Please extract all files from the ZIP before running.
    echo.
    pause
    exit /b 1
)
