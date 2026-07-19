// Standard QC checklist for smartphones (Android & iPhone)
// Grouped by category, keys are stable identifiers

export const QC_CHECKLIST = [
  {
    category: "Layar & Tampilan",
    items: [
      { key: "display", name: "Layar display (warna, brightness, tidak dead pixel)" },
      { key: "touchscreen", name: "Touchscreen (semua area & multi-touch)" },
      { key: "rotation", name: "Rotasi layar (accelerometer)" },
    ],
  },
  {
    category: "Kamera",
    items: [
      { key: "cam_rear", name: "Kamera belakang (fokus & foto)" },
      { key: "cam_front", name: "Kamera depan (fokus & foto)" },
      { key: "flash", name: "Flash / Senter" },
    ],
  },
  {
    category: "Audio",
    items: [
      { key: "loudspeaker", name: "Speaker (loudspeaker)" },
      { key: "earpiece", name: "Earpiece (speaker panggilan)" },
      { key: "mic", name: "Mikrofon (rekam suara)" },
      { key: "vibrator", name: "Getar / Vibrator" },
    ],
  },
  {
    category: "Konektivitas",
    items: [
      { key: "wifi", name: "WiFi" },
      { key: "bluetooth", name: "Bluetooth" },
      { key: "signal_sim", name: "Sinyal seluler & SIM card" },
      { key: "gps", name: "GPS / Lokasi" },
    ],
  },
  {
    category: "Biometrik & Sensor",
    items: [
      { key: "biometric", name: "Fingerprint / Face ID" },
      { key: "proximity", name: "Sensor proximity (auto-off saat telepon)" },
    ],
  },
  {
    category: "Tombol",
    items: [
      { key: "btn_power", name: "Tombol Power" },
      { key: "btn_volume", name: "Tombol Volume (+/-)" },
    ],
  },
  {
    category: "Charging & Baterai",
    items: [
      { key: "charging", name: "Port charger & pengisian daya" },
      { key: "battery", name: "Baterai (persen naik, tidak cepat drop)" },
    ],
  },
  {
    category: "Panggilan & Sistem",
    items: [
      { key: "call", name: "Panggilan keluar/masuk (2 arah)" },
    ],
  },
];

// Flat list helper
export const QC_ITEMS_FLAT = QC_CHECKLIST.flatMap((cat) =>
  cat.items.map((it) => ({ ...it, category: cat.category }))
);
