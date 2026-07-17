# Update Service HP Manager to a new version
# Run: powershell -ExecutionPolicy Bypass -File update.ps1
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
$InstallRoot = "C:\ServiceHP"
$SrcRoot     = Read-Host "Path folder update (contoh: C:\Users\Owner\Downloads\service-hp-managemer-main)"

if (-not (Test-Path "$SrcRoot\backend\server.py")) {
  Write-Host "Folder update tidak valid. Pastikan berisi subfolder backend & frontend." -ForegroundColor Red
  exit 1
}

Write-Host "Menghentikan aplikasi..." -ForegroundColor Cyan
& "$InstallRoot\stop.bat"

Write-Host "Backup config lama..." -ForegroundColor Cyan
Copy-Item "$InstallRoot\backend\.env" "$InstallRoot\backend\.env.bak" -Force
Copy-Item "$InstallRoot\config.env"   "$InstallRoot\config.env.bak" -Force

Write-Host "Copy file baru..." -ForegroundColor Cyan
Copy-Item -Path "$SrcRoot\backend\server.py"        -Destination "$InstallRoot\backend\server.py" -Force
Copy-Item -Path "$SrcRoot\backend\requirements.txt" -Destination "$InstallRoot\backend\requirements.txt" -Force
Copy-Item -Path "$SrcRoot\frontend\src"             -Destination "$InstallRoot\frontend\src" -Recurse -Force
Copy-Item -Path "$SrcRoot\frontend\package.json"    -Destination "$InstallRoot\frontend\package.json" -Force

Write-Host "Restore config..." -ForegroundColor Cyan
Move-Item "$InstallRoot\backend\.env.bak" "$InstallRoot\backend\.env" -Force
Move-Item "$InstallRoot\config.env.bak"   "$InstallRoot\config.env" -Force

Write-Host "Update Python deps..." -ForegroundColor Cyan
& "$InstallRoot\backend\.venv\Scripts\pip.exe" install -r "$InstallRoot\backend\requirements.txt"

Write-Host "Update Frontend & rebuild..." -ForegroundColor Cyan
Push-Location "$InstallRoot\frontend"
& yarn install
& yarn build
Pop-Location

Write-Host "Menjalankan aplikasi..." -ForegroundColor Green
Start-Process "$InstallRoot\run.bat"
Write-Host "Update selesai." -ForegroundColor Green
