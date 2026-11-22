@echo off
REM Double-click this file to start Ankabut on Windows.
REM If Windows says "Windows protected your PC", click "More info", then "Run anyway".
REM
REM What it does:
REM   1. checks that Node.js is installed (and opens the download page if not),
REM   2. the first time only, downloads the parts Ankabut needs (1 to 3 minutes),
REM   3. starts Ankabut and opens it in your browser.
REM To stop Ankabut, close this black window.

title Ankabut
cd /d "%~dp0"
echo.
echo   Ankabut is starting...
echo.

where node >nul 2>nul
if errorlevel 1 goto nonode

node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>20||(a===20&&b>=19)?0:1)"
if errorlevel 1 goto oldnode

if exist node_modules goto run
echo   First start: downloading what Ankabut needs. This takes 1 to 3 minutes...
call npm install
if errorlevel 1 goto installfail

:run
echo.
echo   Ankabut is opening in your browser.
echo   Keep this window open while you use it. Close it to stop Ankabut.
echo.
call npm run dev -- --open
pause
exit /b 0

:nonode
echo   Node.js is not installed yet.
echo   Your browser will open nodejs.org. Download the LTS version, install it
echo   (keep the default options), then double-click this file again.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:oldnode
echo   Your Node.js is too old. Ankabut needs version 20.19 or newer.
echo   Your browser will open nodejs.org. Install the LTS version, then try again.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:installfail
echo.
echo   The download failed. Check your internet connection and try again.
echo   If it says EPERM, close other programs and try again (antivirus can slow it down).
pause
exit /b 1
