# =============================================================================
#  Service HP Manager - Windows One-Click Installer
#  Run: powershell -ExecutionPolicy Bypass -File install.ps1
# =============================================================================
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

# ---- Config -----------------------------------------------------------------
$AppName        = "Service HP Manager"
$InstallRoot    = "C:\ServiceHP"
$SrcRoot        = $PSScriptRoot
$PortBackend    = 8001
$PortFrontend   = 3000
$JwtSecret      = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object {[char]$_})

# ---- UI helpers -------------------------------------------------------------
function Write-Step($msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok  ($msg)  { Write-Host "  [OK] $msg"   -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "  [!!] $msg"   -ForegroundColor Yellow }
function Write-Err ($msg)  { Write-Host "  [ER] $msg"   -ForegroundColor Red }

Write-Host @"
=======================================================
   Service HP Manager - Windows Installer
=======================================================
"@ -ForegroundColor Magenta

# ---- 1. Ensure winget (comes with Windows 11/10 22H2+) ---------------------
Write-Step "Cek prasyarat winget"
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Err "winget tidak ditemukan. Install 'App Installer' dari Microsoft Store dulu."
  exit 1
}
Write-Ok "winget tersedia"

# ---- 2. Install Node.js LTS -------------------------------------------------
Write-Step "Cek Node.js"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "  Node.js tidak ditemukan. Menginstall LTS..."
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent | Out-Null
  $env:Path = "$env:Path;C:\Program Files\nodejs\"
  Write-Ok "Node.js terinstall"
} else {
  Write-Ok "Node.js: $(& node --version)"
}

# ---- 3. Install Python 3.11 ------------------------------------------------
Write-Step "Cek Python"
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
  Write-Host "  Python tidak ditemukan. Menginstall Python 3.11..."
  winget install -e --id Python.Python.3.11 --accept-package-agreements --accept-source-agreements --silent | Out-Null
  Write-Ok "Python terinstall"
} else {
  Write-Ok "Python: $(& python --version)"
}

# ---- 4. Install MongoDB Community Server -----------------------------------
Write-Step "Cek MongoDB"
$mongo = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if (-not $mongo) {
  Write-Host "  MongoDB tidak ditemukan. Menginstall MongoDB 7.0..."
  winget install -e --id MongoDB.Server --accept-package-agreements --accept-source-agreements --silent | Out-Null
  Start-Sleep -Seconds 8
  $mongo = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
  if ($mongo) {
    Start-Service MongoDB
    Set-Service MongoDB -StartupType Automatic
    Write-Ok "MongoDB service berjalan"
  } else {
    Write-Warn "MongoDB service tidak terdeteksi. Kalau gagal, install manual dari mongodb.com/try/download/community"
  }
} else {
  if ($mongo.Status -ne "Running") { Start-Service MongoDB }
  Write-Ok "MongoDB: $($mongo.Status)"
}

# ---- 5. Yarn (via corepack) ------------------------------------------------
Write-Step "Aktifkan Yarn"
& corepack enable 2>$null | Out-Null
Write-Ok "Yarn siap"

# ---- 6. Copy files ---------------------------------------------------------
Write-Step "Copy file aplikasi ke $InstallRoot"
if (-not (Test-Path $InstallRoot)) { New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null }
Copy-Item -Path "$SrcRoot\..\backend"  -Destination "$InstallRoot\backend"  -Recurse -Force
Copy-Item -Path "$SrcRoot\..\frontend" -Destination "$InstallRoot\frontend" -Recurse -Force
# Clean node_modules & venv if copied
if (Test-Path "$InstallRoot\frontend\node_modules") { Remove-Item "$InstallRoot\frontend\node_modules" -Recurse -Force }
if (Test-Path "$InstallRoot\backend\.venv")         { Remove-Item "$InstallRoot\backend\.venv"         -Recurse -Force }
New-Item -ItemType Directory -Path "$InstallRoot\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallRoot\data" -Force | Out-Null
Write-Ok "File tercopy"

# ---- 7. Config env ---------------------------------------------------------
Write-Step "Setup config"
$backendEnv = @"
MONGO_URL=mongodb://localhost:27017
DB_NAME=service_hp_manager
CORS_ORIGINS=*
JWT_SECRET=$JwtSecret
PUBLIC_APP_URL=http://localhost:$PortFrontend
"@
Set-Content -Path "$InstallRoot\backend\.env" -Value $backendEnv -Encoding UTF8

# Frontend .env kosong (biar api.js pakai auto-detect current host + :8001)
Set-Content -Path "$InstallRoot\frontend\.env" -Value "REACT_APP_BACKEND_URL=" -Encoding UTF8

$configEnv = @"
PORT_BACKEND=$PortBackend
PORT_FRONTEND=$PortFrontend
INSTALL_ROOT=$InstallRoot
"@
Set-Content -Path "$InstallRoot\config.env" -Value $configEnv -Encoding UTF8
Write-Ok "Config tersimpan"

# ---- 8. Install Python deps ------------------------------------------------
Write-Step "Install dependency Python"
Push-Location "$InstallRoot\backend"
& python -m venv .venv
& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\.venv\Scripts\pip.exe" install -r requirements.txt
Pop-Location
Write-Ok "Python deps ready"

# ---- 9. Install Frontend deps & build -------------------------------------
Write-Step "Install dependency Frontend & build production"
Push-Location "$InstallRoot\frontend"
& yarn install
& yarn build
Pop-Location
Write-Ok "Frontend build selesai"

# ---- 10. Serve build (install `serve` global) -----------------------------
Write-Step "Install web server (serve)"
& npm install -g serve
Write-Ok "serve terinstall"

# ---- 11. Copy runtime scripts ---------------------------------------------
Write-Step "Copy start scripts"
Copy-Item -Path "$SrcRoot\run.bat"       -Destination "$InstallRoot\run.bat" -Force
Copy-Item -Path "$SrcRoot\stop.bat"      -Destination "$InstallRoot\stop.bat" -Force
Copy-Item -Path "$SrcRoot\update.ps1"    -Destination "$InstallRoot\update.ps1" -Force
Copy-Item -Path "$SrcRoot\uninstall.ps1" -Destination "$InstallRoot\uninstall.ps1" -Force
Copy-Item -Path "$SrcRoot\enable-lan.ps1" -Destination "$InstallRoot\enable-lan.ps1" -Force
Write-Ok "Runtime scripts ok"

# ---- 12. Windows Firewall (allow LAN access) -------------------------------
Write-Step "Konfigurasi Windows Firewall untuk akses LAN"
& powershell -ExecutionPolicy Bypass -File "$InstallRoot\enable-lan.ps1" -PortBackend $PortBackend -PortFrontend $PortFrontend
Write-Ok "Firewall rule ditambahkan"

# ---- 13. Desktop & Start Menu shortcut ------------------------------------
Write-Step "Buat shortcut Desktop & Start Menu"
$WshShell = New-Object -ComObject WScript.Shell
$Desktop  = [Environment]::GetFolderPath("Desktop")
$StartMenu= [Environment]::GetFolderPath("StartMenu") + "\Programs"
foreach ($loc in @($Desktop, $StartMenu)) {
  $Shortcut = $WshShell.CreateShortcut("$loc\$AppName.lnk")
  $Shortcut.TargetPath = "$InstallRoot\run.bat"
  $Shortcut.WorkingDirectory = $InstallRoot
  $Shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,44"
  $Shortcut.WindowStyle = 7  # minimized
  $Shortcut.Description = "Jalankan Service HP Manager"
  $Shortcut.Save()
}
Write-Ok "Shortcut created"

# ---- 14. Task Scheduler (auto-start on boot, optional) --------------------
Write-Step "Setup auto-start (Task Scheduler)"
$taskName = "ServiceHPManager-AutoStart"
& schtasks /Query /TN $taskName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { & schtasks /Delete /TN $taskName /F | Out-Null }
$action = "cmd.exe /c start `"`" `"$InstallRoot\run.bat`""
& schtasks /Create /TN $taskName /TR $action /SC ONLOGON /RL HIGHEST /F | Out-Null
Write-Ok "Auto-start terpasang (jalan saat login Windows)"

# ---- 15. First-run: launch app --------------------------------------------
Write-Step "Menjalankan aplikasi..."
Start-Process "cmd.exe" -ArgumentList "/c", "start", "", "$InstallRoot\run.bat"

Start-Sleep -Seconds 8
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual" } | Where-Object { $_.IPAddress -notmatch "^169\." } | Select-Object -First 1).IPAddress

Write-Host @"

===================================================================
  INSTALASI SELESAI!
===================================================================
  App URL (PC ini)     : http://localhost:$PortFrontend
  App URL (LAN)        : http://$ip:$PortFrontend
  Backend API          : http://localhost:$PortBackend/api

  Akun default:
    - Owner   : owner@servicehp.id   / owner123
    - Admin   : admin@servicehp.id   / admin123
    - Teknisi : teknisi@servicehp.id / teknisi123
    - Kasir   : kasir@servicehp.id   / kasir123

  Data:      $InstallRoot\data
  Logs:      $InstallRoot\logs
  Update:    powershell $InstallRoot\update.ps1
  Uninstall: powershell $InstallRoot\uninstall.ps1
===================================================================
"@ -ForegroundColor Green

Start-Process "http://localhost:$PortFrontend"
