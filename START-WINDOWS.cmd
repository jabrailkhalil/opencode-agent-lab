@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22+ is required & pause & exit /b 1)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (pause & exit /b 1)
)
call npm run check || (pause & exit /b 1)
node tools/launch.mjs --open
if errorlevel 1 pause

