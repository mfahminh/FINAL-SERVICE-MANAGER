export const PRINTOUT_TYPES = {
  service_intake: {
    title: "Tanda Terima",
    description: "Bukti penerimaan unit dan QR untuk pelacakan status service.",
    fields: [
      ["showLogo", "Logo toko"],
      ["showShopName", "Nama toko"],
      ["showAddress", "Alamat toko"],
      ["showPhone", "Nomor telepon / WhatsApp"],
      ["showCustomer", "Nama pelanggan dan nomor HP"],
      ["showDevice", "Merek dan model perangkat"],
      ["showImei", "IMEI"],
      ["showComplaint", "Keluhan pelanggan"],
      ["showEstimate", "Estimasi biaya"],
      ["showQr", "QR code tracking"],
      ["showFooter", "Footer"],
    ],
  },
  service_final: {
    title: "Nota Service",
    description: "Nota pelunasan setelah perbaikan selesai atau unit diambil.",
    fields: [
      ["showLogo", "Logo toko"],
      ["showShopName", "Nama toko"],
      ["showAddress", "Alamat toko"],
      ["showPhone", "Nomor telepon / WhatsApp"],
      ["showCustomer", "Nama dan nomor HP pelanggan"],
      ["showDevice", "Informasi perangkat"],
      ["showImei", "IMEI"],
      ["showComplaint", "Keluhan dan tindakan"],
      ["showTechnician", "Teknisi"],
      ["showItems", "Rincian sparepart"],
      ["showCosts", "Ringkasan biaya dan pembayaran"],
      ["showQc", "Hasil quality control"],
      ["showWarranty", "Informasi garansi"],
      ["showFooter", "Footer"],
    ],
  },
  service_cancel: {
    title: "Nota Pembatalan",
    description: "Rincian tagihan saat service dibatalkan.",
    fields: [
      ["showLogo", "Logo toko"],
      ["showShopName", "Nama toko"],
      ["showAddress", "Alamat toko"],
      ["showPhone", "Nomor telepon / WhatsApp"],
      ["showCustomer", "Nama pelanggan"],
      ["showDevice", "Informasi perangkat"],
      ["showItems", "Rincian sparepart dan jasa"],
      ["showCosts", "Total tagihan dan pembayaran"],
      ["showReason", "Alasan pembatalan"],
      ["showFooter", "Footer"],
    ],
  },
  service_label: {
    title: "Label Service",
    description: "Label identifikasi untuk ditempel pada perangkat.",
    fields: [
      ["showLogo", "Logo toko"],
      ["showShopName", "Nama toko"],
      ["showAddress", "Alamat toko"],
      ["showPhone", "Nomor telepon / WhatsApp"],
      ["showCustomer", "Nama pelanggan"],
      ["showDevice", "Merek dan model perangkat"],
      ["showImei", "Empat digit terakhir IMEI"],
      ["showDate", "Tanggal masuk"],
      ["showTechnician", "Teknisi"],
      ["showStatus", "Status service"],
      ["showQr", "QR code tracking"],
      ["showBarcode", "Barcode nomor service"],
      ["showFooter", "Footer"],
    ],
  },
  pos_sale: {
    title: "Nota Penjualan",
    description: "Struk penjualan sparepart langsung.",
    fields: [
      ["showLogo", "Logo toko"],
      ["showShopName", "Nama toko"],
      ["showAddress", "Alamat toko"],
      ["showPhone", "Nomor telepon / WhatsApp"],
      ["showCustomer", "Pelanggan"],
      ["showCashier", "Nama kasir"],
      ["showItems", "Rincian barang"],
      ["showCosts", "Subtotal, diskon, total, bayar, dan kembalian"],
      ["showFooter", "Footer"],
    ],
  },
  technician_slip: {
    title: "Slip Komisi Teknisi",
    description: "Rincian komisi teknisi dalam periode yang dipilih.",
    fields: [
      ["showLogo", "Logo toko"],
      ["showShopName", "Nama toko"],
      ["showAddress", "Alamat toko"],
      ["showTechnician", "Identitas dan persentase teknisi"],
      ["showPeriod", "Periode dan jumlah pekerjaan"],
      ["showItems", "Rincian service dan komisi"],
      ["showCosts", "Total komisi"],
      ["showSignature", "Area tanda tangan"],
      ["showFooter", "Footer"],
    ],
  },
};

export const PRINTOUT_DEFAULTS = Object.fromEntries(
  Object.entries(PRINTOUT_TYPES).map(([key, definition]) => [
    key,
    {
      design: "professional",
      footer: "",
      ...Object.fromEntries(definition.fields.map(([field]) => [field, true])),
    },
  ])
);

export function getPrintoutConfig(settings, type) {
  return {
    ...(PRINTOUT_DEFAULTS[type] || {}),
    ...(settings?.printout_settings?.[type] || {}),
  };
}
