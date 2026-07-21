Local print bridge (Windows/macOS/Linux)

Usage:
1. Install Node.js (>=14). In this folder run:
   npm init -y
   npm install express serialport body-parser cors

2. Start the bridge:
   node index.js

3. Check available ports (in another terminal or browser):
   curl http://localhost:3000/ports

4. Print a simple test (replace COM5 with your printer port):
   curl -X POST http://localhost:3000/print-test -H "Content-Type: application/json" -d '{"port":"COM5"}'

5. Print arbitrary ESC/POS bytes (base64):
   curl -X POST http://localhost:3000/print -H "Content-Type: application/json" -d '{"port":"COM5","data_base64":"BASE64_HERE"}'

How to find COM port (Windows):
- Settings -> Bluetooth & devices -> More Bluetooth options -> COM Ports. Or Device Manager -> Ports (COM & LPT)

Security: The bridge listens on localhost only. Do not expose this port to untrusted networks.
