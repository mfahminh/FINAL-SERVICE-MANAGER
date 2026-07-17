@echo off
REM =============================================================
REM  Service HP Manager - Runtime launcher
REM  Start backend + frontend, open browser
REM =============================================================
setlocal
cd /d %~dp0

REM Load config
for /f "usebackq tokens=1,2 delims==" %%A in ("config.env") do set %%A=%%B
if "%PORT_BACKEND%"==""  set PORT_BACKEND=8001
if "%PORT_FRONTEND%"=="" set PORT_FRONTEND=3000

REM Kill previous instances (dev-friendly)
taskkill /F /FI "WINDOWTITLE eq ServiceHP-Backend*"  >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq ServiceHP-Frontend*" >nul 2>&1

REM Ensure MongoDB running
sc query MongoDB | find "RUNNING" >nul
if errorlevel 1 (
  echo Starting MongoDB service...
  net start MongoDB >nul 2>&1
)

echo ============================================
echo   Service HP Manager
echo   Backend port : %PORT_BACKEND%
echo   Frontend port: %PORT_FRONTEND%
echo ============================================

REM Start backend (uvicorn) - listen 0.0.0.0 for LAN access
start "ServiceHP-Backend" /min cmd /c ^
  "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port %PORT_BACKEND% >> ..\logs\backend.log 2>&1"

REM Start frontend (production build served by 'serve') - LAN accessible
start "ServiceHP-Frontend" /min cmd /c ^
  "cd /d %~dp0frontend && serve -s build -l tcp://0.0.0.0:%PORT_FRONTEND% >> ..\logs\frontend.log 2>&1"

REM Wait for services to be up
echo Menunggu server siap...
timeout /t 6 /nobreak >nul

REM Open browser
start "" http://localhost:%PORT_FRONTEND%

echo.
echo Server berjalan di background.
echo Tutup jendela ini bebas — untuk stop app, jalankan stop.bat.
echo.
pause
