@echo off
title ElectroPOS Server
echo ===================================================
echo Starting ElectroPOS...
echo ===================================================
cd /d "%~dp0server"

:: Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org and try again.
    pause
    exit /b 1
)

:: Wait 2 seconds and open default browser
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3001"

:: Start the application
echo ElectroPOS is running at http://localhost:3001
echo Press Ctrl+C to stop the server.
echo ===================================================
node src/index.js
pause
