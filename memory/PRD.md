# Service HP Manager — PRD

## Original Problem Statement
Full-stack phone service business management app (Indonesian) covering intake → diagnosis → repair → spareparts → payment → pickup → warranty. Multi-role: Owner, Admin, Teknisi, Kasir. UI: modern SaaS dashboard with sidebar, dark/light mode, charts, responsive.

## User Choices Adopted
- 1a: React + FastAPI + MongoDB
- 2b: Core flow + Laporan + Audit Log + Settings
- 3a: WhatsApp mocked (modular endpoint `/api/whatsapp/send`)
- 4a: JWT-based custom auth (httpOnly cookies, bcrypt)
- 5a: Seed data (4 demo users + customers + spareparts + supplier)

## Architecture
- Backend: FastAPI single `server.py` (~700 lines), MongoDB (Motor async), JWT cookies + bearer fallback, bcrypt hashing, brute-force lockout (5 attempts/15min), audit logging
- Frontend: React 19 + react-router-dom 7 + Tailwind + Shadcn UI + Recharts + qrcode.react, IBM Plex Sans body + Outfit display font, Swiss high-contrast design (Archetype 4) with Signal Orange primary

## Personas
- Owner: full admin + reports + user management + audit
- Admin: most ops, no user delete
- Teknisi: diagnosa + sparepart usage
- Kasir: pembayaran + pickup

## Implemented (2026-02-13)

### Feature (2026-07-16 - Sesi 2)
- **Direct Sale Sparepart (POS)** — halaman baru `/direct-sale` untuk owner/admin/kasir:
  - Grid sparepart click-to-add, keranjang dengan qty & harga adjustable
  - Customer optional, method (cash/transfer/qris/debit), diskon, bayar/kembalian
  - Endpoint `POST /api/direct-sales` (auto-generate `DS20260716xxx`), reduce stock, inventory_history
  - `POST /api/direct-sales/{sid}/refund` — restore stock
  - Riwayat bulan ini + nota printable dengan header custom
- **Pembelian ditingkatkan**:
  - Expandable detail item per PO (Sparepart, Qty, Harga, Subtotal)
  - `PATCH /api/purchases/{id}` — edit PO (auto-reverse stock lama + apply stock baru + inventory_history)
  - `DELETE /api/purchases/{id}` — hapus PO (owner only, reverse stock)
- **Laporan baru**:
  - `GET /api/reports/purchases?start&end&group=item|day|month`
  - `GET /api/reports/sparepart-sales?start&end&source=all|service|direct&group=item|sparepart|day|month`
  - Reports UI: 2 tab baru — **Pembelian** & **Penjualan Sparepart** dengan Excel/PDF export
  - Penjualan Sparepart mendukung filter Sumber (Semua/Service/Direct) + 4 grouping
- **Export ditambah**: `type=purchases` & `type=sparepart-sales` di endpoint `/api/reports/export`
- **Reset Database** (owner only) — `POST /api/admin/reset-database` dengan konfirmasi ketik "RESET DATABASE" persis + opsi pertahankan users/settings. Setelah reset otomatis re-seed default data. Terintegrasi di Settings → Danger Zone.
- **Custom Print Header/Footer** — 9 field baru di Settings:
  - NOTA: `print_header_title`, `print_header_subtitle`, `print_header_address`, `print_header_phone`, `print_footer_text`
  - LABEL: `label_header_title`, `label_footer_text`
  - QR: `qr_header_title`, `qr_footer_text`
  - Sudah terpakai di Nota Pembatalan & Nota Service Final (fallback ke shop_name)

### Perbaikan Pembayaran & Laporan (2026-07-16)
- **Fix "Sisa" negatif**: bila `total_paid > final_cost`, sekarang tampil sebagai **"Kembali"** (hijau) alih-alih Sisa negatif (orange).
- **Fix formula profit**: dari `profit = total_paid - sparepart_cost` (salah, cash-based) → `profit = final_cost - sparepart_cost` (benar, revenue-based). Terapkan di 4 lokasi: create/diagnose, use_sparepart, cancel_sparepart, update_service_fee, cancel-service.
- **Formula Komisi Teknisi**: sekarang `komisi = % komisi × service_fee (Biaya Jasa)` — bukan lagi dari profit. Berlaku di `/api/my-jobs`, `/api/reports/technicians`, laporan laba teknisi & slip gaji.
- **Laporan baru**:
  - **`GET /api/reports/technicians-profit`** — laba teknisi per periode (start/end filter).
  - **`GET /api/reports/technician/{id}/slip`** — data slip gaji per teknisi dengan rentang custom.
  - **`GET /api/reports/export?type=&format=&start=&end=&group=`** — export ke **Excel (.xlsx)** & **PDF** untuk 6 tipe: revenue, services, spareparts, technicians-profit, salary-slip, financial.
  - Revenue & Services report kini support **grouping** = `item` | `day` | `month`.
- **Reports.jsx redesign**:
  - 4 tab: Pendapatan / Service / Sparepart / **Laba Teknisi**
  - Setiap tab: dropdown Grouping (item/hari/bulan) + tombol Excel + PDF
  - Tab Laba Teknisi: tabel ranking dengan tombol **"Slip Gaji"** per teknisi
  - Dialog Slip Gaji: date range picker, preview slip printable, tombol Download PDF & Cetak
- Backend dependencies: `openpyxl==3.1.5`, `reportlab==5.0.0`.

### Perbaikan (2026-07-15)
- **Sensor No HP untuk role teknisi & kasir**: helper `maskPhone()`.
- **Biaya Jasa editable**: `service_fee` + `PATCH /service-fee`.
- **Batal penggunaan sparepart**: `DELETE /services/{sid}/items/{item_id}`.
- **Konfirmasi Pembatalan Service** + 2 opsi sparepart (return / charge) + Nota Pembatalan printable.
- **Guard status Dibatalkan** (backend & UI) — semua endpoint aksi ditolak, tab dinonaktifkan.
- **Workflow QC + Role Baru** (2026-07-15):
  - **PATCH /status** dikunci owner/admin saja. `POST /services` dikunci owner/admin/kasir (teknisi tidak bisa buat).
  - **Teknisi**: tombol **"Selesai Mengerjakan"** (`POST /finish-work`) → status otomatis "Quality Control", `finished_at` tersimpan.
  - **Halaman QC** baru: `/qc` (owner/admin) — list service `status = Quality Control` dengan tombol "Mulai QC".
  - **QC Checklist** standar HP Android/iPhone (21 item, 8 kategori: Layar, Kamera, Audio, Konektivitas, Sensor, Tombol, Charging, Panggilan). Dialog dengan tombol "Semua Normal / Reset (Error)", catatan per item error, catatan keseluruhan.
  - **Endpoint** `POST /services/{sid}/qc`:
    - All OK → status "Selesai" + `qc_passed=true`
    - Ada error → status "Sedang Dikerjakan" + `qc_failed=true` + notify teknisi
  - **Notifikasi QC gagal** di halaman "Pekerjaan Saya" teknisi — card merah "QC Gagal — Perlu Diperbaiki" dengan daftar item error, klik ke Service Detail.
  - **Nota Service Final** (setelah pickup) — printable, berisi: data pelanggan + no HP + device + IMEI + keluhan + teknisi + ringkasan biaya (jasa + sparepart + total + dibayar + kembali) + **checklist hasil QC** (semua item) + garansi + syarat garansi.
  - Pickup endpoint kini menolak service yang belum berstatus "Selesai" (harus lulus QC dulu).

### Pre-existing features
- Auth: login, logout, me, forgot/reset-password, role-based middleware
- Dashboard: stat cards (services today/in-progress/done/low-stock/revenue), 7-day revenue area chart, 7-day services bar chart, recent services, audit feed
- Customers CRUD + search by name/phone
- Service workflow: 3-step intake (Pelanggan → Device → Keluhan & Biaya), auto service number SV{yyyymmdd}NNNN, status timeline with 9 statuses, diagnose tab (teknisi), use-sparepart with auto stock decrement, payments tab (multi-method DP/Pelunasan), pickup checklist (unit ok/paid/warranty explained) with warranty (7/14/30/60/90 days), QR code + thermal receipt print, mock WhatsApp send
- Spareparts CRUD + low-stock filter + inventory history (in/out)
- Suppliers CRUD
- Purchases: line items, auto PO number, auto-restock spareparts
- Payments list with total
- Reports: revenue / services / spareparts with date range + CSV export
- Audit log (owner/admin only)
- Settings (shop info, tax, WA template)
- Users management (owner/admin)
- Public tracking page at `/track/:sn` (no auth) with QR linking back
- Global search header (Nomor Service/IMEI/Nama/HP)
- Dark + Light theme toggle (persisted in localStorage)
- All interactive elements have `data-testid`

## Test Credentials (`/app/memory/test_credentials.md`)
| Role | Email | Password |
|---|---|---|
| Owner | owner@servicehp.id | owner123 |
| Admin | admin@servicehp.id | admin123 |
| Teknisi | teknisi@servicehp.id | teknisi123 |
| Kasir | kasir@servicehp.id | kasir123 |

## Test Results (iteration_1)
- Backend: **100%** (18/18 endpoints verified incl. RBAC, public tracking, mock WA)
- Frontend: **95%** (all flows render, no JS errors)
- Only LOW issue: testid naming mismatch (`theme-toggle-btn` exists vs expected `theme-toggle`) — non-blocking

## Backlog (P0/P1/P2)
- P1: Real WhatsApp provider integration (Fonnte/Wablas/Twilio) when user provides keys
- P1: File upload for service photos (currently `photos: []` array; integrate object storage)
- P2: Multi-cabang / Multi-gudang
- P2: PWA + offline mode
- P2: Komisi teknisi & laporan teknisi
- P2: Midtrans / Xendit payment gateway
- P2: Barcode/QR scanning via camera (currently only QR generation)
- P2: PDF invoice via react-pdf (CSV export already works)
- P2: Multi bahasa (Indonesia/English)

## Session 2026-07-17 — Restore & Run
- Kode dari zip (`service-hp-managemer-main.zip`) disalin ke `/app`
- Backend deps di-install (fastapi, motor, bcrypt, PyJWT, openpyxl, reportlab). `emergentintegrations` dihapus dari requirements.txt karena tidak dipakai & konflik dependency
- `JWT_SECRET` ditambahkan ke `backend/.env`
- Supervisor: backend + frontend RUNNING
- Verified: login owner OK, dashboard render, sidebar 15+ menu tampil, seed data terpasang (4 users + customers + spareparts + supplier)
