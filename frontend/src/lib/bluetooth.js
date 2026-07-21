/**
 * Bluetooth thermal printer support via Web Bluetooth API.
 * Sends ESC/POS data to paired thermal printers (58mm, 80mm, 100mm).
 * 
 * Works on: Chrome/Edge, Android Chrome
 * Automatically discovers SPP/RFCOMM services for thermal printers.
 */

const LS_DEVICE_NAME = "bt-printer-name";
const LS_DEVICE_UUID = "bt-printer-uuid";

function isBluetoothAvailable() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

/**
 * Connect to a Bluetooth thermal printer.
 * Uses broader discovery with multiple SPP service UUIDs.
 */
export async function connectPrinter() {
  if (!isBluetoothAvailable()) {
    throw new Error("Browser ini tidak support Web Bluetooth (pakai Chrome/Edge di Android/Desktop)");
  }

  try {
    // Request device with broader filters for thermal printers
    // Most thermal printers expose SPP service
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: "printer" },
        { namePrefix: "thermal" },
        { namePrefix: "receipt" },
        { namePrefix: "pos" },
        { namePrefix: "pt" },
        { namePrefix: "iprint" },
        { namePrefix: "xp" },
      ],
      optionalServices: [
        "00001101-0000-1000-8000-00805f9b34fb", // Serial Port Profile (SPP)
        "000018f0-0000-1000-8000-00805f9b34fb", // Device Info alternative
        "0000180a-0000-1000-8000-00805f9b34fb", // Device Information Service
      ],
    });

    if (!device) throw new Error("Tidak ada printer yang dipilih");

    // Store device info
    localStorage.setItem(LS_DEVICE_NAME, device.name || "Printer Bluetooth");
    if (device.id) localStorage.setItem(LS_DEVICE_UUID, device.id);

    // Connect to GATT
    const server = await device.gatt.connect();
    
    // Try to find SPP service (most common for thermal printers)
    let service = null;
    const serviceUUIDs = [
      "00001101-0000-1000-8000-00805f9b34fb", // SPP
      "000018f0-0000-1000-8000-00805f9b34fb", // alternative
    ];

    for (const uuid of serviceUUIDs) {
      try {
        service = await server.getPrimaryService(uuid);
        break;
      } catch (e) {
        // Try next UUID
      }
    }

    if (!service) {
      // If no known service, try to get first available service
      const services = await server.getPrimaryServices();
      if (services.length === 0) throw new Error("Printer tidak punya service GATT yang tersedia");
      service = services[0];
    }

    // Get writable characteristic
    let characteristic = null;
    const charUUIDs = [
      "00002a19-0000-1000-8000-00805f9b34fb", // TX characteristic
      "00002a05-0000-1000-8000-00805f9b34fb", // Service Changed
    ];

    for (const uuid of charUUIDs) {
      try {
        characteristic = await service.getCharacteristic(uuid);
        break;
      } catch (e) {
        // Try next
      }
    }

    // If still no characteristic, get first writable one
    if (!characteristic) {
      const chars = await service.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties.write || ch.properties.writeWithoutResponse) {
          characteristic = ch;
          break;
        }
      }
    }

    if (!characteristic) {
      throw new Error("Printer tidak punya characteristic yang bisa ditulis (TX)");
    }

    return { device, server, service, characteristic };
  } catch (err) {
    // Better error messages
    if (err.message.includes("No Bluetooth adapter")) {
      throw new Error("Bluetooth tidak aktif di perangkat ini");
    }
    if (err.message.includes("User cancelled") || err.message.includes("cancelled")) {
      throw new Error("Pemilihan printer dibatalkan");
    }
    if (err.message.includes("NotFoundError")) {
      throw new Error("Tidak ada printer Bluetooth ditemukan. Pastikan printer sudah dipair di pengaturan Bluetooth.");
    }
    throw new Error(err.message || "Gagal koneksi ke printer Bluetooth");
  }
}

/**
 * Send ESC/POS bytes to Bluetooth printer.
 * Tries writeValue first, falls back to writeValueWithoutResponse.
 */
export async function sendBluetoothRaw(characteristic, bytesData) {
  if (!characteristic) throw new Error("Printer Bluetooth tidak terhubung");

  const CHUNK = 240; // Smaller chunks for Bluetooth stability
  let successCount = 0;

  for (let i = 0; i < bytesData.length; i += CHUNK) {
    const chunk = bytesData.slice(i, i + CHUNK);
    try {
      // Try with response first
      if (characteristic.properties.write) {
        await characteristic.writeValue(chunk);
      } else if (characteristic.properties.writeWithoutResponse) {
        // Without response is faster and works for most thermal printers
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        throw new Error("Characteristic tidak support write");
      }
      
      successCount++;
      // Small delay between chunks to prevent overflow
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      throw new Error(`Gagal kirim data chunk ${successCount + 1}/${Math.ceil(bytesData.length / CHUNK)}: ${err.message}`);
    }
  }
  return true;
}

/**
 * Print with connection retry logic.
 * Caches connection during session, retries if fails.
 */
let cachedConnection = null;
let connectionAttempts = 0;

export async function printBluetoothRaw(bytesData, deviceName = null) {
  try {
    // Try cached connection first
    if (cachedConnection) {
      try {
        await sendBluetoothRaw(cachedConnection.characteristic, bytesData);
        connectionAttempts = 0; // Reset on success
        return true;
      } catch (err) {
        // Connection died, clear cache and retry
        console.warn("Cached connection failed:", err.message);
        cachedConnection = null;
      }
    }

    // Prevent infinite retry loops
    if (connectionAttempts > 2) {
      throw new Error("Koneksi gagal berkali-kali. Coba ulang atau ganti printer.");
    }

    connectionAttempts++;
    
    // New connection
    const conn = await connectPrinter();
    cachedConnection = conn;
    connectionAttempts = 0;
    
    await sendBluetoothRaw(conn.characteristic, bytesData);
    return true;
  } catch (err) {
    cachedConnection = null;
    throw err;
  }
}

export function getSavedPrinterName() {
  return localStorage.getItem(LS_DEVICE_NAME);
}

export function clearCachedConnection() {
  cachedConnection = null;
  connectionAttempts = 0;
}

export function isConnectionCached() {
  return !!cachedConnection;
}

export { isBluetoothAvailable };

