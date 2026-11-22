@echo off
cd /d "%~dp0"
if not exist node_modules (
    call npm install
    if errorlevel 1 (pause & exit /b 1)
)
docker compose up -d
if errorlevel 1 (
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)
if not exist dist\index.html call npm run build
if not exist desktop\dist\main.js call npm run build
call npm run start
pause
