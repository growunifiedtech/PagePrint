@echo off
title PagePrint Desktop Agent
echo ========================================================
echo        Starting PagePrint Desktop Background Agent
echo ========================================================
cd /d "%~dp0"
if exist "PagePrint.exe" (
    start "" "PagePrint.exe"
) else (
    start "" node index.js
)
echo [OK] PagePrint Agent is now running in the background.
echo Check your dashboard at http://localhost:3000/dashboard
timeout /t 3 >nul
exit
