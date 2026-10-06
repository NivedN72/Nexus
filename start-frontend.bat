@echo off
title Nexus Frontend Server
echo ==========================================
echo Starting Nexus Frontend Development Server
echo ==========================================
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0frontend"
echo Running on http://localhost:5173 ...
npm run dev
pause
