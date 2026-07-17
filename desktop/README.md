Service HP Manager — Windows Desktop Installer
==============================================

Paket ini menginstall aplikasi Service HP Manager di PC Windows dengan
cara "next-next". Setelah install:
- Aplikasi jalan otomatis saat Windows startup (opsional)
- Bisa diakses dari device lain di jaringan Wi-Fi yang sama
  (kasir tablet, HP teknisi, dsb) via http://<ip-pc>:3000

Persyaratan
-----------
- Windows 10 atau 11 (64-bit)
- 4GB RAM minimum
- 2GB free disk
- Koneksi Internet saat install (untuk download dependency)

Cara Install
------------
1. Klik-kanan install.ps1 → Run with PowerShell (as Administrator)
   ATAU buka PowerShell as Admin lalu jalankan:
       powershell -ExecutionPolicy Bypass -File install.ps1
2. Ikuti prompt di layar. Installer akan:
   - Cek/install Node.js, Python, MongoDB (jika belum ada)
   - Copy semua file aplikasi ke C:\ServiceHP
   - Install dependency Python & Node
   - Build frontend production
   - Buat shortcut di Desktop & Start Menu
   - Setup auto-start via Task Scheduler
   - Konfigurasi Windows Firewall untuk akses LAN
3. Setelah selesai, klik shortcut "Service HP Manager" di Desktop
4. Browser otomatis buka http://localhost:3000
5. Login default:
       Email: owner@servicehp.id
       Password: owner123

Akses dari Device Lain di Jaringan Sama
---------------------------------------
1. Cek IP address PC ini: buka CMD, ketik `ipconfig`, catat "IPv4 Address"
   (contoh: 192.168.1.10)
2. Di HP/tablet, buka browser dan akses:
       http://192.168.1.10:3000
3. Login dengan akun masing-masing (kasir, teknisi, dsb)

Uninstall
---------
Klik-kanan uninstall.ps1 → Run with PowerShell as Admin.
Ini akan hapus service, shortcut, dan folder C:\ServiceHP.

Troubleshooting
---------------
- **"Aplikasi tidak bisa diakses dari HP"**:
  Cek Windows Firewall — jalankan `enable-lan.ps1` lagi.
- **"MongoDB gagal start"**:
  Buka Services (services.msc), cari "MongoDB", start manual.
- **"Port 3000/8001 sudah dipakai"**:
  Edit config.env di C:\ServiceHP, ubah PORT_FRONTEND / PORT_BACKEND.
- **Aplikasi tidak update setelah pull code baru**:
  Jalankan `update.ps1` untuk re-build & restart.

Support
-------
- Log server: C:\ServiceHP\logs\
- Reset password: hapus file C:\ServiceHP\data\.seeded lalu restart
