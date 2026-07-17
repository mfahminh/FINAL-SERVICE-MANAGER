@echo off
echo Menghentikan Service HP Manager...
taskkill /F /FI "WINDOWTITLE eq ServiceHP-Backend*"  >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq ServiceHP-Frontend*" >nul 2>&1
REM Fallback: kill by port
for /f "tokens=5" %%P in ('netstat -aon ^| findstr :8001 ^| findstr LISTENING') do taskkill /F /PID %%P >nul 2>&1
for /f "tokens=5" %%P in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%P >nul 2>&1
echo Selesai.
timeout /t 2 >nul
