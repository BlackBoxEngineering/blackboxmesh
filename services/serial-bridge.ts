/**
 * BlackBoxMesh USB serial bridge.
 *
 * Sits between the Heltec firmware (USB CDC on COM3) and the rest of the
 * stack. Responsibilities:
 *   - Read lines from the device (`BN RX ...`, `BN STATUS ...`, etc.) and
 *     forward them to the local MQTT bridge (and later, AWS IoT Core).
 *   - Poll the GPS bridge (phone-via-adb) every 10s and push the fix down
 *     to the device as `BN GPS <lat> <lon> <acc>`.
 *
 * No WiFi credentials on the device — it just speaks LoRa + USB serial.
 */
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { decodeFrame } from './meshtastic-decoder';

const PORT_PATH   = process.env.BLACKBOXMESH_SERIAL_PORT   ?? 'COM3';
const BAUD        = Number(process.env.BLACKBOXMESH_SERIAL_BAUD ?? 115200);
const GPS_URL     = process.env.BLACKBOXMESH_GPS_URL     ?? 'http://localhost:8080/gps';
const MQTT_URL    = process.env.BLACKBOXMESH_MQTT_URL    ?? 'http://localhost:8081';
const GPS_POLL_MS = Number(process.env.BLACKBOXMESH_GPS_POLL_MS ?? 10000);

interface GpsFix {
  coords?: { latitude?: number; longitude?: number; accuracy?: number };
  latitude?: number;
  longitude?: number;
}

let nodeId: string | null = null;

const port = new SerialPort({ path: PORT_PATH, baudRate: BAUD }, (err) => {
  if (err) {
    console.error(`[serial] Failed to open ${PORT_PATH}: ${err.message}`);
    process.exit(1);
  }
  console.log(`[serial] Opened ${PORT_PATH} @ ${BAUD}`);
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

function send(line: string): void {
  port.write(line + '\n', (err) => {
    if (err) console.error('[serial] write error', err.message);
  });
}

async function postJson(url: string, body: unknown): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`[mqtt] POST ${url} -> ${res.status}`);
    }
  } catch (e) {
    // bridge may not be running yet; that's ok
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[mqtt] POST ${url} failed: ${msg}`);
  }
}

/** Parse `BN RX <from> <to> <type> <hops> <rssi> <snr> <hex>` */
function parseRx(rest: string) {
  const parts = rest.trim().split(/\s+/);
  if (parts.length < 7) return null;
  return {
    from:    parts[0],
    to:      parts[1],
    type:    Number(parts[2]),
    hops:    Number(parts[3]),
    rssi:    Number(parts[4]),
    snr:     Number(parts[5]),
    payload: parts[6],
  };
}

parser.on('data', async (raw: string) => {
  const line = raw.trim();
  if (!line) return;

  // Always echo to stdout so we can tail the bridge log.
  console.log(`[dev>] ${line}`);

  if (line.startsWith('BN READY ')) {
    nodeId = line.slice(9).trim();
    console.log(`[serial] device ready, nodeId=${nodeId}`);
    return;
  }

  if (line.startsWith('BN RX ')) {
    const rx = parseRx(line.slice(6));
    if (rx) {
      await postJson(`${MQTT_URL}/report`, {
        nodeId:    rx.from,
        type:      'rx',
        targetId:  rx.to,
        msgType:   rx.type,
        hops:      rx.hops,
        rssi:      rx.rssi,
        snr:       rx.snr,
        payload:   rx.payload,
        timestamp: Date.now(),
      });
    }
    return;
  }

  if (line.startsWith('BN STATUS ')) {
    const jsonPart = line.slice(10);
    try {
      const status = JSON.parse(jsonPart);
      await postJson(`${MQTT_URL}/report`, { ...status, timestamp: Date.now() });
    } catch (e) {
      console.warn('[serial] bad STATUS json:', jsonPart);
    }
    return;
  }

  if (line.startsWith('BN MTRX ')) {
    // Meshtastic observer frame: `BN MTRX <rssi> <snr> <hex>`
    const parts = line.slice(8).trim().split(/\s+/);
    if (parts.length >= 3) {
      const rssi = Number(parts[0]);
      const snr  = Number(parts[1]);
      const hex  = parts[2];
      const decoded = decodeFrame(hex);
      await postJson(`${MQTT_URL}/report`, {
        nodeId:    nodeId ?? 'observer',
        type:      'meshtastic_observed',
        rssi,
        snr,
        payload:   hex,
        length:    hex.length / 2,
        meshtastic: {
          from: decoded.from,
          to: decoded.to,
          packetId: decoded.packetId,
          channelHash: decoded.channelHash,
          hopLimit: decoded.hopLimit,
          decrypted: decoded.decrypted,
          portnum: decoded.portnum,
          text: decoded.text,
          nodeInfo: decoded.nodeInfo,
          position: decoded.position,
        },
        timestamp: Date.now(),
      });
    }
    return;
  }
});

parser.on('error', (err: Error) => console.error('[serial] parse error', err.message));
port.on('error',   (err: Error) => console.error('[serial] port error', err.message));
port.on('close',   ()           => { console.error('[serial] port closed'); process.exit(1); });

async function pollGps(): Promise<void> {
  try {
    const res = await fetch(GPS_URL);
    if (!res.ok) return;
    const fix = (await res.json()) as GpsFix;
    const lat = fix.coords?.latitude  ?? fix.latitude;
    const lon = fix.coords?.longitude ?? fix.longitude;
    const acc = fix.coords?.accuracy  ?? 0;
    if (
      typeof lat === 'number' && typeof lon === 'number' &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
    ) {
      send(`BN GPS ${lat.toFixed(6)} ${lon.toFixed(6)} ${acc.toFixed(1)}`);
    }
  } catch (e) {
    // gps bridge may be offline; ignore
  }
}

setInterval(pollGps, GPS_POLL_MS);
// First poll shortly after device announces ready
setTimeout(pollGps, 2000);

console.log(`[bridge] BlackBoxMesh serial bridge`);
console.log(`  port:  ${PORT_PATH} @ ${BAUD}`);
console.log(`  gps:   ${GPS_URL}  (every ${GPS_POLL_MS}ms)`);
console.log(`  mqtt:  ${MQTT_URL}`);
