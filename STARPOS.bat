@echo off
setlocal enabledelayedexpansion
title ElectroPOS - Smart Point of Sale
echo ========================================================
echo                 Starting ElectroPOS...
echo ========================================================
echo.

:: 1. Check if Node.js is available in existing system PATH
where node >nul 2>nul
if %errorlevel% equ 0 goto node_ready

:: 2. Check if portable Node.js was previously downloaded in .node
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
echo ========================================================
echo  [INFO] Node.js was not found in your system PATH.
echo  [INFO] Auto-downloading portable Node.js LTS...
echo ========================================================
echo.

if not exist "%~dp0.node" mkdir "%~dp0.node"
set "NODE_ZIP=%~dp0.node\node-lts-win-x64.zip"
set "NODE_URL=https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"

echo Downloading Node.js runtime from nodejs.org...
where curl >nul 2>nul
if %errorlevel% equ 0 (
    curl.exe -fL --progress-bar "%NODE_URL%" -o "%NODE_ZIP%"
    goto check_download
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%NODE_URL%', '%NODE_ZIP%')"

:check_download
if not exist "%NODE_ZIP%" (
    echo.
    echo [ERROR] Failed to download Node.js automatically.
    echo Please install Node.js manually from https://nodejs.org and re-run.
    pause
    exit /b 1
)

echo.
echo Extracting Node.js package...
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
    echo [ERROR] Could not configure downloaded Node.js.
    echo Please download and install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js portable configured successfully.
echo.

:node_ready
cd /d "%~dp0server"

:: Check server dependencies
if not exist "%~dp0server\node_modules" (
    echo [INFO] Installing server dependencies...
    call npm install --silent
)

:: Verify SQLite driver compatibility
node -e "const DB = require('better-sqlite3'); new DB(':memory:');" >nul 2>nul
if %errorlevel% equ 0 goto sqlite_ok

echo ========================================================
echo  [!] SQLite driver version mismatch detected.
echo  [!] Automatically configuring database binary for this Node...
echo ========================================================
echo.

if exist "%~dp0server\node_modules\better-sqlite3" (
    cd /d "%~dp0server\node_modules\better-sqlite3"
    call npx prebuild-install --force
    cd /d "%~dp0server"
)

node -e "const DB = require('better-sqlite3'); new DB(':memory:');" >nul 2>nul
if %errorlevel% equ 0 goto sqlite_ok

echo [INFO] Rebuilding better-sqlite3 driver...
call npm rebuild better-sqlite3

node -e "const DB = require('better-sqlite3'); new DB(':memory:');" >nul 2>nul
if %errorlevel% equ 0 goto sqlite_ok

echo [INFO] Reinstalling better-sqlite3 package...
call npm install --force better-sqlite3

:sqlite_ok
echo.

:: Ensure client build exists
if not exist "%~dp0client\dist" (
    echo [INFO] Building web application frontend...
    cd /d "%~dp0client"
    if not exist "%~dp0client\node_modules" call npm install --silent
    call npm run build
    cd /d "%~dp0server"
)

:: Wait 2 seconds and open default browser
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3001"

:: Start the application
echo ========================================================
echo  ElectroPOS is running at: http://localhost:3001
echo  Press Ctrl+C to stop the server.
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
