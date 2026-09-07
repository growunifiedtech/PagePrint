@echo off
title PagePrint Desktop Agent
echo ========================================================
echo        Starting PagePrint Desktop Agent
echo ========================================================
cd /d "%~dp0"
if exist "PagePrint.exe" (
    "PagePrint.exe"
) else (
    node agent\index.js
)
pause
