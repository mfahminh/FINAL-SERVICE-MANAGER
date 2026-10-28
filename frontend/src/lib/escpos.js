import { getPrintoutConfig } from "@/lib/printoutSettings";

/**
 * ESC/POS printer via Web USB API.
 * Support: text (with alignment/bold/size), separator lines, QR code,
 * barcode (CODE128), cut, cash drawer kick.
 *
 * Works in Chrome/Edge on Windows (secure context / HTTPS or localhost).
 * User is prompted once to select the printer; the choice is persisted
 * automatically by Chrome per origin.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function bytes(...arr) { return new Uint8Array(arr.flat()); }
function txt(str) { return new TextEncoder().encode(str); }

export function initPrinter() { return bytes([ESC, 0x40]); } // reset
export function feed(n = 1) { return bytes([ESC, 0x64, n]); }
export function cutPaper(partial = false) { return bytes([GS, 0x56, partial ? 0x01 : 0x00]); }
export function align(mode) { // 0=left 1=center 2=right
  return bytes([ESC, 0x61, mode]);
}
export function bold(on) { return bytes([ESC, 0x45, on ? 1 : 0]); }
export function doubleHeight(on) { return bytes([GS, 0x21, on ? 0x01 : 0x00]); }
export function textSize(w = 0, h = 0) { return bytes([GS, 0x21, (w << 4) | h]); }
export function underline(mode = 0) { return bytes([ESC, 0x2d, mode]); }
export function cashKick() { return bytes([ESC, 0x70, 0x00, 0x19, 0xff]); }

// QR: model 2, size L (M=48), correction L
export function qrCode(data, size = 6) {
  const model = bytes([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
  const sizeCmd = bytes([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size]);
  const errCmd = bytes([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30]);
  const enc = new TextEncoder().encode(data);
  const pL = (enc.length + 3) & 0xff;
  const pH = ((enc.length + 3) >> 8) & 0xff;
  const store = bytes([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30], Array.from(enc));
  const print = bytes([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
  const out = new Uint8Array(model.length + sizeCmd.length + errCmd.length + store.length + print.length);
  let off = 0;
  for (const b of [model, sizeCmd, errCmd, store, print]) { out.set(b, off); off += b.length; }
  return out;
}

// Barcode CODE128
export function barcode128(data) {
  const set = txt("{B" + data); // subset B
  const parts = [
    bytes([GS, 0x68, 60]),          // height 60
    bytes([GS, 0x77, 2]),           // width 2
    bytes([GS, 0x66, 0]),           // hri font none
    bytes([GS, 0x48, 0]),           // no hri position
    bytes([GS, 0x6b, 0x49, set.length]), Array.from(set), [LF],
  ].flat();
  return new Uint8Array(parts);
}

export function line(str = "", opts = {}) {
  const parts = [];
  if (opts.align !== undefined) parts.push(align(opts.align));
  if (opts.bold) parts.push(bold(true));
  if (opts.size) parts.push(textSize(opts.size, opts.size));
  parts.push(txt(str + "\n"));
  if (opts.size) parts.push(textSize(0, 0));
  if (opts.bold) parts.push(bold(false));
  const total = parts.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export function separator(char = "-", width = 32) {
  return txt(char.repeat(width) + "\n");
}

/** Two-column left/right within given char width. */
export function kv(left, right, width = 32) {
  const l = String(left);
  const r = String(right);
  const pad = Math.max(1, width - l.length - r.length);
  const line = l.length + r.length >= width
    ? (l + "\n" + " ".repeat(Math.max(0, width - r.length)) + r + "\n")
    : (l + " ".repeat(pad) + r + "\n");
  return txt(line);
}

export function concat(...chunks) {
  const total = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

/** =====================================================================
 *  WebUSB device management
 *  =====================================================================
 */
const LS_KEY = "escpos-device-info";

function isWebUsbAvailable() {
  return typeof navigator !== "undefined" && !!navigator.usb;
}

async function findKnownDevice() {
  if (!isWebUsbAvailable()) return null;
  const devices = await navigator.usb.getDevices();
  if (!devices.length) return null;
  const saved = localStorage.getItem(LS_KEY);
  if (saved) {
    const { vendorId, productId } = JSON.parse(saved);
    const match = devices.find((d) => d.vendorId === vendorId && d.productId === productId);
    if (match) return match;
  }
  return devices[0];
}

export async function pickPrinter() {
  if (!isWebUsbAvailable()) throw new Error("Browser tidak support Web USB (pakai Chrome/Edge di HTTPS/localhost)");
  const device = await navigator.usb.requestDevice({ filters: [] });
  localStorage.setItem(LS_KEY, JSON.stringify({
    vendorId: device.vendorId,
    productId: device.productId,
    productName: device.productName || "",
    manufacturerName: device.manufacturerName || "",
  }));
  return device;
}

export function getSavedPrinterInfo() {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function clearSavedPrinter() { localStorage.removeItem(LS_KEY); }

async function ensureConfigured(device) {
  if (!device.opened) await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  const cfg = device.configuration;
  // Find printer interface (usually class 7) or first interface with out endpoint
  let ifaceIndex = 0, epOut = null;
  for (let i = 0; i < cfg.interfaces.length; i++) {
    const iface = cfg.interfaces[i];
    for (const alt of iface.alternates) {
      const outEp = alt.endpoints.find((e) => e.direction === "out");
      if (outEp) {
        ifaceIndex = iface.interfaceNumber;
        epOut = outEp;
        break;
      }
    }
    if (epOut) break;
  }
  if (!epOut) throw new Error("Printer USB tidak punya endpoint OUT");
  try { await device.claimInterface(ifaceIndex); }
  catch (e) {
    // If already claimed by kernel driver on Windows/Mac it's usually fine, try alternate
    console.warn("claimInterface:", e.message);
  }
  return epOut.endpointNumber;
}

export async function sendRaw(bytesData) {
  if (!isWebUsbAvailable()) throw new Error("Web USB tidak tersedia di browser ini");
  let device = await findKnownDevice();
  if (!device) device = await pickPrinter();
  const epOut = await ensureConfigured(device);
  const CHUNK = 512;
  for (let i = 0; i < bytesData.length; i += CHUNK) {
    await device.transferOut(epOut, bytesData.slice(i, i + CHUNK));
  }
  return true;
}

/** =====================================================================
 *  High-level builders (Service Nota, Label, QR receipt, POS receipt)
 *  =====================================================================
 */
function fmtRp(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return "Rp " + v.toLocaleString("id-ID");
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** char width based on paper size */
function widthFor(paper) {
  const p = (paper || "80mm").toLowerCase();
  if (p === "58mm") return 32;
  if (p === "80mm") return 42;
  if (p === "100mm") return 56;
  return 42;
}

async function logoRaster(settings, config, maxWidth) {
  if (!config.showLogo || !settings?.logo || typeof Image === "undefined") return new Uint8Array();
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("Logo tidak dapat dibaca untuk printer thermal"));
    image.src = settings.logo;
  });
  const scale = Math.min(1, maxWidth / image.naturalWidth, 160 / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas tidak tersedia untuk mencetak logo");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const rowBytes = Math.ceil(width / 8);
  const raster = new Uint8Array(8 + rowBytes * height);
  raster.set([GS, 0x76, 0x30, 0x00, rowBytes & 0xff, (rowBytes >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const gray = 0.299 * pixels[pixel] + 0.587 * pixels[pixel + 1] + 0.114 * pixels[pixel + 2];
      if (gray < 160) raster[8 + y * rowBytes + Math.floor(x / 8)] |= 0x80 >> (x % 8);
    }
  }
  return raster;
}

async function printHeader(settings, profile, documentTitle, width, paperWidth) {
  const config = getPrintoutConfig(settings, profile);
  const title = settings?.print_header_title || settings?.shop_name || "SERVICE HP";
  const chunks = [align(1)];
  const logo = await logoRaster(settings, config, Math.min(576, widthFor(paperWidth) * 12));
  if (logo.length) chunks.push(logo, txt("\n"));
  if (config.showShopName) chunks.push(bold(true), textSize(1, 1), txt(title + "\n"), textSize(0, 0), bold(false));
  if (settings?.print_header_subtitle) chunks.push(txt(settings.print_header_subtitle + "\n"));
  const address = settings?.print_header_address || settings?.address;
  const phone = settings?.print_header_phone || settings?.whatsapp;
  if (config.showAddress && address) chunks.push(txt(address + "\n"));
  if (config.showPhone && phone) chunks.push(txt("Telp: " + phone + "\n"));
  chunks.push(bold(true), txt(documentTitle + "\n"), bold(false), separator("=", width), align(0));
  return chunks;
}

function printFooter(settings, config, fallback, typeFooter = "") {
  if (!config.showFooter) return new Uint8Array();
  return concat(align(1), txt((config.footer || typeFooter || settings?.print_footer_text || fallback) + "\n"));
}

export async function buildServiceIntakeReceipt(svc, settings, trackUrl) {
  const w = widthFor(settings?.printer_qr_width);
  const config = getPrintoutConfig(settings, "service_intake");
  const chunks = [
    initPrinter(),
    ...(await printHeader(settings, "service_intake", settings?.qr_header_title || "TANDA TERIMA SERVICE", w, settings?.printer_qr_width)),
    kv("No.", svc.service_number, w),
    kv("Tgl", fmtDate(svc.created_at), w),
    config.showCustomer ? kv("Cust", svc.customer_name || "-", w) : new Uint8Array(),
    config.showCustomer ? kv("No HP", svc.customer_phone || "-", w) : new Uint8Array(),
    config.showDevice ? kv("Device", (svc.brand || "") + " " + (svc.model || ""), w) : new Uint8Array(),
    config.showImei && svc.imei1 ? kv("IMEI", svc.imei1, w) : new Uint8Array(),
    config.showComplaint ? txt("Keluhan:\n" + (svc.complaint || "-") + "\n") : new Uint8Array(),
    config.showEstimate ? kv("Estimasi", fmtRp(svc.estimated_cost), w) : new Uint8Array(),
    separator("-", w),
  ];
  if (config.showQr) chunks.push(align(1), qrCode(trackUrl, 6), txt("Scan untuk cek status\n"), txt(trackUrl + "\n"));
  chunks.push(separator("=", w), printFooter(settings, config, "Scan untuk cek status", settings?.qr_footer_text), feed(3), cutPaper());
  return concat(...chunks);
}

export async function buildServiceLabel(svc, settings, trackUrl) {
  const w = widthFor(settings?.printer_label_width);
  const config = getPrintoutConfig(settings, "service_label");
  const chunks = [
    initPrinter(),
    ...(await printHeader(settings, "service_label", settings?.label_header_title || "SERVICE TAG", w, settings?.printer_label_width)),
  ];
  if (config.showQr) chunks.push(align(1), qrCode(trackUrl, 5));
  chunks.push(bold(true), textSize(1, 1), txt(svc.service_number + "\n"), textSize(0, 0), bold(false));
  if (config.showBarcode) chunks.push(barcode128(svc.service_number));
  chunks.push(
    align(0),
    config.showCustomer ? kv("Cust", svc.customer_name || "-", w) : new Uint8Array(),
    config.showDevice ? kv("Dev", (svc.brand || "") + " " + (svc.model || ""), w) : new Uint8Array(),
    config.showImei && svc.imei1 ? kv("IMEI", "****" + svc.imei1.slice(-4), w) : new Uint8Array(),
    config.showDate ? kv("Masuk", fmtDate(svc.created_at), w) : new Uint8Array(),
    config.showTechnician && svc.assigned_technician_name ? kv("Teknisi", svc.assigned_technician_name, w) : new Uint8Array(),
    config.showStatus ? kv("Status", svc.status || "-", w) : new Uint8Array(),
    separator("-", w),
    printFooter(settings, config, "", settings?.label_footer_text),
    feed(2), cutPaper()
  );
  return concat(...chunks);
}

export async function buildFinalServiceNota(svc, settings) {
  const w = widthFor(settings?.printer_nota_width);
  const config = getPrintoutConfig(settings, "service_final");
  const items = svc.items_used || [];
  const chunks = [
    initPrinter(),
    ...(await printHeader(settings, "service_final", "NOTA SERVICE", w, settings?.printer_nota_width)),
    kv("No.", svc.service_number, w),
    kv("Tgl", fmtDate(svc.pickup?.at || svc.updated_at), w),
    config.showCustomer ? kv("Cust", svc.customer_name || "-", w) : new Uint8Array(),
    config.showDevice ? kv("Device", (svc.brand || "") + " " + (svc.model || ""), w) : new Uint8Array(),
    config.showImei && svc.imei1 ? kv("IMEI", svc.imei1, w) : new Uint8Array(),
    config.showTechnician && svc.assigned_technician_name ? kv("Teknisi", svc.assigned_technician_name, w) : new Uint8Array(),
    config.showComplaint ? txt("Tindakan:\n" + (svc.diagnosis?.action || svc.complaint || "-") + "\n") : new Uint8Array(),
    separator("-", w),
  ];
  if (config.showCosts) {
    chunks.push(txt("Ringkasan Biaya\nBiaya Jasa\n"));
    if (config.showItems) for (const it of items) chunks.push(txt(`${it.name} x${it.qty}\n`));
    chunks.push(
      separator("-", w),
      bold(true), kv("TOTAL", fmtRp(svc.final_cost || 0), w), bold(false),
      kv("Dibayar", fmtRp(svc.total_paid || 0), w),
      kv("Sisa", fmtRp(Math.max(0, (svc.final_cost || 0) - (svc.total_paid || 0))), w),
      separator("-", w),
    );
  }
  if (config.showWarranty && svc.warranty_days) {
    chunks.push(
      align(0),
      bold(true), txt(`Garansi: ${svc.warranty_days} hari\n`), bold(false),
      svc.warranty_until ? txt("Berlaku hingga " + fmtDate(svc.warranty_until) + "\n") : new Uint8Array(),
    );
  }
  if (config.showQc && svc.qc_result) {
    chunks.push(txt("Hasil QC:\n"));
    for (const item of (svc.qc_result.items || [])) chunks.push(txt(`${item.name}: ${item.ok ? "OK" : "Perlu dicek"}\n`));
    if (svc.qc_result.overall_note) chunks.push(txt(`Catatan QC: ${svc.qc_result.overall_note}\n`));
  }
  chunks.push(
    printFooter(settings, config, "Terima kasih"),
    feed(3), cutPaper()
  );
  return concat(...chunks);
}

export async function buildPOSReceipt(sale, settings) {
  const w = widthFor(settings?.printer_nota_width);
  const config = getPrintoutConfig(settings, "pos_sale");
  const chunks = [
    initPrinter(),
    ...(await printHeader(settings, "pos_sale", "STRUK PENJUALAN", w, settings?.printer_nota_width)),
    kv("No.", sale.sale_number || sale.id?.slice(0, 8) || "-", w),
    kv("Tgl", fmtDate(sale.created_at || new Date().toISOString()), w),
    config.showCustomer && sale.customer_name ? kv("Cust", sale.customer_name, w) : new Uint8Array(),
    config.showCashier && sale.cashier_name ? kv("Kasir", sale.cashier_name, w) : new Uint8Array(),
    config.showItems ? separator("-", w) : new Uint8Array(),
  ];
  if (config.showItems) {
    for (const it of (sale.items || [])) {
      chunks.push(txt(it.name + "\n"), kv(` ${it.qty} x ${fmtRp(it.price)}`, fmtRp((it.price || 0) * (it.qty || 0)), w));
    }
  }
  if (config.showCosts) chunks.push(
    separator("-", w),
    kv("Subtotal", fmtRp(sale.subtotal ?? sale.total ?? 0), w),
    (sale.discount || 0) > 0 ? kv("Diskon", "-" + fmtRp(sale.discount), w) : new Uint8Array(),
    bold(true), kv("TOTAL", fmtRp(sale.total || 0), w), bold(false),
    kv(`Bayar${sale.method ? ` (${sale.method})` : ""}`, fmtRp(sale.paid || sale.total || 0), w),
    kv("Kembali", fmtRp(Math.max(0, (sale.paid || 0) - (sale.total || 0))), w),
  );
  chunks.push(separator("=", w), printFooter(settings, config, "Terima kasih"), feed(3), cutPaper());
  return concat(...chunks);
}
