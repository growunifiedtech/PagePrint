@echo off
setlocal enabledelayedexpansion
title Install PagePrint Auto-Start Service
color 0F

echo ========================================================
echo     PagePrint Windows 1-Click Silent Auto-Start Setup
echo ========================================================
echo.

cd /d "%~dp0"
set "SRC_DIR=%~dp0"

:: 1. Locate PagePrint.exe
set "PAGEPRINT_SRC="
if exist "%SRC_DIR%PagePrint.exe" (
    set "PAGEPRINT_SRC=%SRC_DIR%PagePrint.exe"
) else if exist "%SRC_DIR%agent\PagePrint.exe" (
    set "PAGEPRINT_SRC=%SRC_DIR%agent\PagePrint.exe"
) else if exist "%SRC_DIR%..\agent\PagePrint.exe" (
    set "PAGEPRINT_SRC=%SRC_DIR%..\agent\PagePrint.exe"
) else if exist "%SRC_DIR%..\PagePrint.exe" (
    set "PAGEPRINT_SRC=%SRC_DIR%..\PagePrint.exe"
)

if "%PAGEPRINT_SRC%"=="" (
    echo [ERROR] PagePrint.exe was not found in this folder!
    echo.
    echo Searched locations:
    echo   - %SRC_DIR%PagePrint.exe
    echo   - %SRC_DIR%agent\PagePrint.exe
    echo.
    echo Please make sure you have extracted all files from the ZIP
    echo and that PagePrint.exe is in the same folder as this script.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo [1/4] Found PagePrint core executable:
echo       "%PAGEPRINT_SRC%"
echo.

:: 2. Target permanent directory in AppData\Local\PagePrint
set "APP_DIR=%LOCALAPPDATA%\PagePrint"
if not exist "%APP_DIR%" mkdir "%APP_DIR%"

echo [2/4] Installing files to permanent folder:
echo       "%APP_DIR%"
copy /y "%PAGEPRINT_SRC%" "%APP_DIR%\PagePrint.exe" >nul

:: Copy SumatraPDF.exe if present
if exist "%SRC_DIR%SumatraPDF.exe" (
    copy /y "%SRC_DIR%SumatraPDF.exe" "%APP_DIR%\SumatraPDF.exe" >nul
) else if exist "%SRC_DIR%agent\SumatraPDF.exe" (
    copy /y "%SRC_DIR%agent\SumatraPDF.exe" "%APP_DIR%\SumatraPDF.exe" >nul
)

:: Copy SumatraPDF-settings.txt if present
if exist "%SRC_DIR%SumatraPDF-settings.txt" (
    copy /y "%SRC_DIR%SumatraPDF-settings.txt" "%APP_DIR%\SumatraPDF-settings.txt" >nul
) else if exist "%SRC_DIR%agent\SumatraPDF-settings.txt" (
    copy /y "%SRC_DIR%agent\SumatraPDF-settings.txt" "%APP_DIR%\SumatraPDF-settings.txt" >nul
)

:: Copy config.json if present
if exist "%SRC_DIR%config.json" (
    copy /y "%SRC_DIR%config.json" "%APP_DIR%\config.json" >nul
) else if exist "%SRC_DIR%agent\config.json" (
    copy /y "%SRC_DIR%agent\config.json" "%APP_DIR%\config.json" >nul
)

:: Strip Windows Zone.Identifier (removes "Open File - Security Warning")
echo [*] Removing Windows download security blocks...
powershell -ExecutionPolicy Bypass -NoProfile -Command "Get-ChildItem -Path '%APP_DIR%' -Recurse -Force -ErrorAction SilentlyContinue | Unblock-File; if (Test-Path '%PAGEPRINT_SRC%') { Unblock-File -Path '%PAGEPRINT_SRC%' -ErrorAction SilentlyContinue }" >nul 2>&1


:: 3. Generate robust silent launcher VBS
echo [3/4] Creating silent background launcher...
set "LAUNCHER_VBS=%APP_DIR%\PagePrint-Silent.vbs"
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo Set fso = CreateObject^("Scripting.FileSystemObject"^)
echo appDir = "%APP_DIR%"
echo exePath = appDir ^& "\PagePrint.exe"
echo WshShell.CurrentDirectory = appDir
echo If fso.FileExists^(exePath^) Then
echo     logDir = appDir ^& "\temp"
echo     If Not fso.FolderExists^(logDir^) Then fso.CreateFolder^(logDir^)
echo     logPath = logDir ^& "\agent.log"
echo     cmdStr = "cmd.exe /c " ^& Chr^(34^) ^& Chr^(34^) ^& exePath ^& Chr^(34^) ^& " > " ^& Chr^(34^) ^& logPath ^& Chr^(34^) ^& " 2>&1" ^& Chr^(34^)
echo     WshShell.Run cmdStr, 0, False
echo Else
echo     MsgBox "PagePrint.exe was not found at:" ^& vbCrLf ^& exePath ^& vbCrLf ^& vbCrLf ^& "Please run Install-PagePrint-AutoStart.bat again.", vbCritical, "PagePrint Service Error"
echo End If
) > "%LAUNCHER_VBS%"

:: 4. Register to Windows Startup folder
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_VBS=%STARTUP_DIR%\PagePrint-AutoStart.vbs"

echo [4/4] Registering into Windows Startup & Registry...
copy /y "%LAUNCHER_VBS%" "%STARTUP_VBS%" >nul
powershell -ExecutionPolicy Bypass -NoProfile -Command "Unblock-File -Path '%STARTUP_VBS%' -ErrorAction SilentlyContinue" >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "PagePrint" /t REG_SZ /d "wscript.exe \"%LAUNCHER_VBS%\"" /f >nul 2>&1


:: Terminate previous instance if running
taskkill /f /im PagePrint.exe >nul 2>&1

:: Launch now via Windows Script Host
echo Starting PagePrint service in background...
wscript.exe "%STARTUP_VBS%"

timeout /t 2 >nul

:: Verify if running
tasklist /fi "imagename eq PagePrint.exe" 2>nul | find /i "PagePrint.exe" >nul
if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  SUCCESS: PagePrint is running and registered to start!
    echo ========================================================
    echo.
    echo  * Status: ACTIVE and listening for counter print orders
    echo  * Auto-Start: Configured in Windows Startup folder
    echo  * Silent Mode: 100%% background - NO black command windows
    echo  * Safe Storage: Installed permanently in %APP_DIR%
    echo.
    echo You can now close this window or delete the Downloads folder.
) else (
    echo.
    echo ========================================================
    echo  NOTE: Auto-Start registered, but process verification pending.
    echo ========================================================
    echo  * If Windows SmartScreen or Antivirus prompted you, click 'Allow'.
    echo  * To manually test, run: "%APP_DIR%\PagePrint.exe"
)

echo.
pause
