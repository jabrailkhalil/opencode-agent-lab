@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.14 or newer from https://nodejs.org/en/download
  echo Then close this window and run INSTALL-WINDOWS.cmd again.
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);if(a<22||(a===22&&b<14)){console.error('Node.js 22.14 or newer is required.');process.exit(1)}"
if errorlevel 1 (pause & exit /b 1)
where npm >nul 2>nul
if errorlevel 1 (echo npm is missing. Reinstall Node.js with npm enabled. & pause & exit /b 1)
call npm ci
if errorlevel 1 (pause & exit /b 1)
call npm run check
if errorlevel 1 (pause & exit /b 1)
call npm test
if errorlevel 1 (pause & exit /b 1)
echo Installation complete. Double-click START-WINDOWS.cmd to open the lab.
pause
