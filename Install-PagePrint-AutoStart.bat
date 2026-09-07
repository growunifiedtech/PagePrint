@echo off
title Install PagePrint Auto-Start Service
echo ========================================================
echo     PagePrint Windows 1-Click Silent Auto-Start Setup
echo ========================================================
echo.
cd /d "%~dp0"

set "TARGET_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_VBS=%STARTUP_DIR%\PagePrint-AutoStart.vbs"

echo [1/3] Creating silent launcher...
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo Set fso = CreateObject^("Scripting.FileSystemObject"^)
echo currentDir = "%TARGET_DIR:~0,-1%"
echo WshShell.CurrentDirectory = currentDir
echo If fso.FileExists^(currentDir ^& "\PagePrint.exe"^) Then
echo     WshShell.Run Chr^(34^) ^& currentDir ^& "\PagePrint.exe" ^& Chr^(34^), 0, False
echo Else
echo     WshShell.Run "node index.js", 0, False
echo End If
) > "%TARGET_DIR%PagePrint-Silent.vbs"

echo [2/3] Registering into Windows Startup folder...
copy /y "%TARGET_DIR%PagePrint-Silent.vbs" "%SHORTCUT_VBS%" >nul

echo [3/3] Starting PagePrint in background now...
wscript.exe "%SHORTCUT_VBS%"

echo.
echo ========================================================
echo  SUCCESS: PagePrint is now configured for Auto-Start!
echo ========================================================
echo.
echo  * PagePrint will now start 100%% silently whenever Windows boots up.
echo  * NO black windows or prompts will ever disturb your screen.
echo  * You never need to start it manually again!
echo.
pause
