const express = require('express');
const SerialPort = require('serialport');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

async function listPorts() {
  try {
    return await SerialPort.list();
  } catch (e) {
    return [];
  }
}

app.get('/ports', async (req, res) => {
  const ports = await listPorts();
  res.json(ports.map(p => ({ path: p.path || p.comName || p.device || p.vendorId ? p.path : undefined, info: p })));
});

function openAndWrite(portPath, baudRate, buffer) {
  return new Promise((resolve, reject) => {
    const sp = new SerialPort(portPath, { baudRate: Number(baudRate) || 9600, autoOpen: false });
    sp.open((err) => {
      if (err) return reject(err);
      sp.write(buffer, (err) => {
        if (err) {
          try { sp.close(() => reject(err)); } catch { reject(err); }
        } else {
          sp.drain((dErr) => {
            try { sp.close(() => { if (dErr) reject(dErr); else resolve(); }); }
            catch { if (dErr) reject(dErr); else resolve(); }
          });
        }
      });
    });
  });
}

app.post('/print', async (req, res) => {
  try {
    const { port, baud = 9600, data_base64 } = req.body;
    if (!port || !data_base64) return res.status(400).json({ error: 'port and data_base64 required' });
    const buf = Buffer.from(data_base64, 'base64');
    await openAndWrite(port, baud, buf);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/print-test', async (req, res) => {
  try {
    const { port, baud = 9600, text = 'TEST BLUETOOTH\n\n\n' } = req.body;
    if (!port) return res.status(400).json({ error: 'port required' });
    // ESC @ reset, text, cut
    const init = Buffer.from([0x1b, 0x40]);
    const body = Buffer.from(text, 'ascii');
    const cut = Buffer.from([0x1d, 0x56, 0x00]);
    const out = Buffer.concat([init, body, cut]);
    await openAndWrite(port, baud, out);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Print bridge listening on http://localhost:${PORT}`));
