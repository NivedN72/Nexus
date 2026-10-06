@echo off
setlocal enabledelayedexpansion
title Nexus Platform - Auto Setup and Launch
color 0B

echo ==========================================================
echo        NEXUS: CAMPUS PLATFORM LAUNCHER
echo ==========================================================
echo.

:: 1. Navigate to frontend directory regardless of drive or path
cd /d "%~dp0frontend"

:: 2. Check for standard Node.js installation paths if not already in system PATH
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;!PATH!"
    ) else if exist "%LocalAppData%\Programs\node\nodejs\node.exe" (
        set "PATH=%LocalAppData%\Programs\node\nodejs;!PATH!"
    )
)

:: 3. If Node.js is still missing, auto-install it via Windows winget
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is not installed on this computer.
    echo [*] Attempting to install Node.js LTS automatically via Windows winget...
    echo.
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;!PATH!"
    ) else (
        echo.
        echo [X] Auto-install failed. Please install Node.js manually from:
        echo     https://nodejs.org/ (LTS Version)
        echo.
        pause
        exit /b 1
    )
)

:: 4. Auto-install dependencies if this is a freshly cloned repository
if not exist "node_modules" (
    echo [*] First-time launch detected! Installing required packages...
    echo [*] This will take about 20-30 seconds...
    call npm install
    if %errorlevel% neq 0 (
        echo [X] npm install encountered an error.
        pause
        exit /b 1
    )
    echo [*] Packages installed successfully!
    echo.
)

:: 5. Launch the development server and open the browser automatically
echo ==========================================================
echo [V] Ready! Launching Nexus in your default browser...
echo [*] Local URL: http://localhost:5173
echo ==========================================================
echo.

:: Automatically open browser after 2 seconds in the background
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5173"

:: Start the Vite development server
call npx vite

pause
