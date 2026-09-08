@echo off
title Remove PagePrint Auto-Start Service
echo ========================================================
echo        Remove PagePrint From Windows Auto-Start
echo ========================================================
echo.
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_DIR%\PagePrint-AutoStart.vbs" (
    del /f /q "%STARTUP_DIR%\PagePrint-AutoStart.vbs" >nul
    echo [OK] Removed PagePrint from Windows Startup folder.
) else (
    echo [INFO] PagePrint auto-start was not registered.
)

taskkill /f /im PagePrint.exe 2>nul
echo [OK] Stopped background PagePrint processes.
echo.
echo PagePrint auto-start has been successfully removed.
pause
