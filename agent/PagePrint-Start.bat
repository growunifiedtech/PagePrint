@echo off
title PagePrint Desktop Agent
echo ========================================================
echo        Starting PagePrint Desktop Background Agent
echo ========================================================
cd /d "%~dp0"
if exist "PagePrint.exe" (
    "PagePrint.exe"
) else (
    node index.js
)
pause
