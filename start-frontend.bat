@echo off
title Nexus Frontend Server
echo ==========================================
echo Starting Nexus Frontend Development Server
echo ==========================================
:: Add standard Node.js path if it exists
if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%PATH%"

:: Dynamically navigate to the frontend folder wherever this project is saved
cd /d "%~dp0frontend"

:: Check if dependencies are installed, if not prompt to install
if not exist "node_modules" (
    echo [INFO] First time setup detected. Installing dependencies...
    call npm install
)

echo Starting server on http://localhost:5173 ...
call npm run dev
pause
