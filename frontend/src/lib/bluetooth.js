/**
 * Bluetooth thermal printer support via Web Bluetooth API.
 * Sends ESC/POS data to paired thermal printers (58mm, 80mm, 100mm).
 * 
 * Works on: Chrome/Edge, Android Chrome, iOS requires alternative.
 * User pairs printer once; connection persists during session.
 */

const LS_DEVICE_NAME = "bt-printer-name";

function isBluetoothAvailable() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

export async function getPairedPrinters() {
  if (!isBluetoothAvailable()) return [];
  try {
    const devices = await navigator.bluetooth.getAvailability();
    return devices ? [] : [];
  } catch {
    return [];
  }
}

/**
 * Connect to a Bluetooth thermal printer.
 * Shows device picker to user; remember last device for future sessions.
 */
export async function connectPrinter() {
  if (!isBluetoothAvailable()) {
    throw new Error("Browser ini tidak support Web Bluetooth (pakai Chrome/Edge di Android/Desktop)");
  }

  try {
    // Request device with Serial Port Profile (SPP) service UUID
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        // Generic thermal printer UUIDs
        { services: ["000018f0-0000-1000-8000-00805f9b34fb"] }, // Serial Port Profile
      ],
      optionalServices: ["00001101-0000-1000-8000-00805f9b34fb"], // SPP alternative
      acceptAllDevices: false,
    });

    if (!device) throw new Error("Tidak ada printer yang dipilih");

    // Store device name for UI display
    localStorage.setItem(LS_DEVICE_NAME, device.name || "Printer Bluetooth");

    // Connect to GATT server
    const server = await device.gatt.connect();

    // Try to get SPP service
    let service;
    try {
      service = await server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb");
    } catch {
      // Try alternative
      service = await server.getPrimaryService("00001101-0000-1000-8000-00805f9b34fb");
    }

    // Get TX characteristic (write to printer)
    const characteristic = await service.getCharacteristic("00002a19-0000-1000-8000-00805f9b34fb").catch(() => 
      service.getCharacteristics()[0] // fallback to first characteristic
    );

    return { device, server, characteristic };
  } catch (err) {
    // If user cancels or no devices found, try generic approach
    if (err.message.includes("No Bluetooth adapter")) {
      throw new Error("Bluetooth tidak aktif di perangkat ini");
    }
    if (err.message.includes("User cancelled")) {
      throw new Error("Pemilihan printer dibatalkan");
    }
    throw new Error(err.message || "Gagal koneksi ke printer Bluetooth");
  }
}

/**
 * Send ESC/POS bytes to Bluetooth printer via characteristic write.
 * Splits large data into chunks (512 bytes) to avoid overflow.
 */
export async function sendBluetoothRaw(characteristic, bytesData) {
  if (!characteristic) throw new Error("Printer Bluetooth tidak terhubung");

  const CHUNK = 512;
  for (let i = 0; i < bytesData.length; i += CHUNK) {
    const chunk = bytesData.slice(i, i + CHUNK);
    try {
      await characteristic.writeValue(chunk);
      // Small delay between chunks to prevent overflow
      await new Promise(r => setTimeout(r, 50));
    } catch (err) {
      throw new Error(`Gagal kirim data ke printer: ${err.message}`);
    }
  }
  return true;
}

/**
 * High-level print function: connects, sends data, handles errors.
 * Caches connection during session for faster subsequent prints.
 */
let cachedConnection = null;

export async function printBluetoothRaw(bytesData, deviceName = null) {
  try {
    // Try cached connection first
    if (cachedConnection) {
      try {
        await sendBluetoothRaw(cachedConnection.characteristic, bytesData);
        return true;
      } catch (err) {
        // Connection died, clear cache
        cachedConnection = null;
      }
    }

    // New connection
    const conn = await connectPrinter();
    cachedConnection = conn;
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
}

export function isConnectionCached() {
  return !!cachedConnection;
}

export { isBluetoothAvailable };
