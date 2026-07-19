import axios from "axios";

// Auto-detect backend URL for LAN/desktop deployment:
// - If REACT_APP_BACKEND_URL is set at build time → use it (cloud/preview mode)
// - Else fallback to same host as browser current location (LAN/desktop mode)
//   e.g. http://192.168.1.10:8001 when accessed from another device
function resolveBackendUrl() {
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (envUrl && envUrl.length > 0) return envUrl;
  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname;
    // Backend runs on port 8001 in desktop/LAN mode
    return `${window.location.protocol}//${host}:8001`;
  }
  return "http://localhost:8001";
}

const BACKEND_URL = resolveBackendUrl();
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Terjadi kesalahan. Coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const fmtIDR = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

export const fmtDate = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// Mask phone for restricted roles (teknisi, kasir) — show only first 3 & last 2 digits
export const maskPhone = (phone, role) => {
  if (!phone) return "-";
  if (role !== "teknisi" && role !== "kasir") return phone;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length <= 5) return "*".repeat(digits.length);
  const head = digits.slice(0, 3);
  const tail = digits.slice(-2);
  const middle = "*".repeat(Math.max(digits.length - 5, 3));
  return `${head}${middle}${tail}`;
};

export const STATUS_COLORS = {
  "Menunggu Diagnosa": "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-700",
  "Sedang Diagnosa": "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700/50",
  "Menunggu Persetujuan": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/50",
  "Menunggu Sparepart": "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/50",
  "Sedang Dikerjakan": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/50",
  "Quality Control": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700/50",
  "Selesai": "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700/50",
  "Sudah Diambil": "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700/50",
  "Dibatalkan": "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/50",
};

export const SERVICE_STATUSES = [
  "Menunggu Diagnosa", "Sedang Diagnosa", "Menunggu Persetujuan",
  "Menunggu Sparepart", "Sedang Dikerjakan", "Quality Control",
  "Selesai", "Sudah Diambil", "Dibatalkan"
];

export default api;
