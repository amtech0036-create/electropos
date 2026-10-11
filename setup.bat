@echo off
setlocal enabledelayedexpansion
title ElectroPOS Setup ^& Launcher
echo ========================================================
echo                 ElectroPOS Setup ^& Start
echo ========================================================
echo.

:: 1. Check if Node.js is already in PATH
where node >nul 2>nul
if %errorlevel% equ 0 goto node_ready

:: 2. Check if portable Node.js was already downloaded
if exist "%~dp0.node\node.exe" (
    set "PATH=%~dp0.node;!PATH!"
    goto check_node
)

for /d %%D in ("%~dp0.node\node-*") do (
    if exist "%%D\node.exe" (
        set "PATH=%%D;!PATH!"
        goto check_node
    )
)

:check_node
where node >nul 2>nul
if %errorlevel% equ 0 goto node_ready

:: 3. Node.js is missing - Auto-download portable Node.js LTS
echo [INFO] Node.js not detected on your PC.
echo [INFO] Automatically downloading portable Node.js (please wait a moment)...
echo.

if not exist "%~dp0.node" mkdir "%~dp0.node"
set "NODE_ZIP=%~dp0.node\node-lts-win-x64.zip"
set "NODE_URL=https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"

where curl >nul 2>nul
if %errorlevel% equ 0 (
    curl.exe -fL --progress-bar "%NODE_URL%" -o "%NODE_ZIP%"
    goto check_download
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%NODE_URL%', '%NODE_ZIP%')"

:check_download
if not exist "%NODE_ZIP%" (
    echo.
    echo [ERROR] Could not download Node.js automatically.
    echo Please check your internet connection or install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [INFO] Extracting Node.js...
where tar >nul 2>nul
if %errorlevel% equ 0 (
    tar -xf "%NODE_ZIP%" -C "%~dp0.node"
    goto finish_extract
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%~dp0.node' -Force"

:finish_extract
if exist "%NODE_ZIP%" del /f /q "%NODE_ZIP%" >nul 2>nul

if exist "%~dp0.node\node.exe" (
    set "PATH=%~dp0.node;!PATH!"
    goto node_verified
)

for /d %%D in ("%~dp0.node\node-*") do (
    if exist "%%D\node.exe" (
        set "PATH=%%D;!PATH!"
        goto node_verified
    )
)

:node_verified
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js configuration failed.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Portable Node.js is ready!
echo.

:node_ready
cd /d "%~dp0server"

:: 4. Verify server dependencies
if not exist "%~dp0server\node_modules" (
    echo [INFO] Installing server dependencies...
    call npm install --silent
)

:: 5. Verify SQLite driver compatibility
node -e "const DB = require('better-sqlite3'); new DB(':memory:');" >nul 2>nul
if %errorlevel% equ 0 goto sqlite_ok

echo [INFO] Setting up database engine for this Windows environment...
if exist "%~dp0server\node_modules\better-sqlite3" (
    cd /d "%~dp0server\node_modules\better-sqlite3"
    call npx prebuild-install --force
    cd /d "%~dp0server"
)

node -e "const DB = require('better-sqlite3'); new DB(':memory:');" >nul 2>nul
if %errorlevel% equ 0 goto sqlite_ok

call npm rebuild better-sqlite3

node -e "const DB = require('better-sqlite3'); new DB(':memory:');" >nul 2>nul
if %errorlevel% equ 0 goto sqlite_ok

call npm install --force better-sqlite3

:sqlite_ok

:: 6. Verify client build
if not exist "%~dp0client\dist" (
    echo [INFO] Preparing frontend interface...
    cd /d "%~dp0client"
    if not exist "%~dp0client\node_modules" call npm install --silent
    call npm run build
    cd /d "%~dp0server"
)

:: 7. Automatically open browser to the application
echo [INFO] Opening ElectroPOS in your browser...
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3001"

:: 8. Launch the ElectroPOS server
echo.
echo ========================================================
echo  ElectroPOS is running at: http://localhost:3001
echo  Keep this window open while using the POS.
echo ========================================================
echo.
node src/index.js
if %errorlevel% neq 0 (
    echo.
    echo ========================================================
    echo  Server stopped with an error code %errorlevel%.
    echo ========================================================
)
pause
