/**
 * BlackBoxMesh Meshtastic Decoder
 *
 * Attempts decryption of observed Meshtastic frames using known/default PSKs.
 * Corrected crypto: AES-128-CTR for 16-byte keys, AES-256-CTR for 32-byte keys.
 *
 * Meshtastic packet layout (off-air, after LoRa demod):
 *   bytes 0-3:   to node ID (LE uint32)
 *   bytes 4-7:   from node ID (LE uint32)
 *   bytes 8-11:  packet ID (LE uint32)
 *   byte  12:    flags (hop_limit:3 | want_ack:1 | via_mqtt:1 | hop_start:3)
 *   byte  13:    channel hash (XOR-fold of channel name)
 *   bytes 14-15: padding/reserved (part of the header, NOT encrypted)
 *   bytes 16+:   AES-CTR encrypted Data protobuf
 *
 * Nonce (128-bit / 16 bytes):
 *   bytes 0-7:   packet ID as LE uint64 (upper 32 = 0)
 *   bytes 8-11:  from node ID (LE uint32)
 *   bytes 12-15: 0x00000000
 *
 * Channel hash: XOR-fold all bytes of the channel name, then XOR with the
 * first byte of the PSK. Default "LongFast" with default key = hash 0x08.
 *
 * Usage:
 *   # Standalone CLI — paste hex frames:
 *   npx ts-node meshtastic-decoder.ts <hex> [<hex> ...]
 *
 *   # As a live service listening to MQTT bridge WebSocket:
 *   npx ts-node meshtastic-decoder.ts --live
 */
import * as crypto from 'crypto';

// ─── Known PSKs ─────────────────────────────────────────────────────────────

interface PSKEntry {
  name: string;
  key: Buffer;   // 16 or 32 bytes
  hash: number;  // expected channel hash byte
}

/** Meshtastic channel hash: XOR all bytes of channel name, then XOR with key[0]. */
function channelHash(channelName: string, key: Buffer): number {
  let h = 0;
  for (let i = 0; i < channelName.length; i++) h ^= channelName.charCodeAt(i);
  h ^= key[0];
  return h & 0xff;
}

/** Expand a base64 PSK to the correct key length (16 or 32 bytes). */
function expandKey(b64: string): Buffer {
  const raw = Buffer.from(b64, 'base64');
  if (raw.length === 32) return raw;
  if (raw.length === 16) return raw;
  // Short keys (e.g. 1 byte "AQ==") get zero-padded to 16
  const key = Buffer.alloc(16, 0);
  raw.copy(key);
  return key;
}

// Default channels with their known PSKs
const KNOWN_CHANNELS: { name: string; psk64: string }[] = [
  { name: 'LongFast',  psk64: '1PG7OiApB1nwvP+rz05pAQ==' },
  { name: 'LongSlow',  psk64: '1PG7OiApB1nwvP+rz05pAQ==' },
  { name: 'MediumFast', psk64: '1PG7OiApB1nwvP+rz05pAQ==' },
  { name: 'MediumSlow', psk64: '1PG7OiApB1nwvP+rz05pAQ==' },
  { name: 'ShortFast', psk64: '1PG7OiApB1nwvP+rz05pAQ==' },
  { name: 'ShortSlow', psk64: '1PG7OiApB1nwvP+rz05pAQ==' },
  // Legacy 1-byte key
  { name: 'LongFast',  psk64: 'AQ==' },
];

// Build PSK table with precomputed hashes
const PSK_TABLE: PSKEntry[] = KNOWN_CHANNELS.map(({ name, psk64 }) => {
  const key = expandKey(psk64);
  return { name: `${name} (${psk64.slice(0, 8)}…)`, key, hash: channelHash(name, key) };
});

// Also try the default key with no channel name (hash = just key[0])
const defaultKey = expandKey('1PG7OiApB1nwvP+rz05pAQ==');
PSK_TABLE.push({ name: 'default (no channel name)', key: defaultKey, hash: defaultKey[0] });

// ─── Crypto ─────────────────────────────────────────────────────────────────

function buildNonce(packetId: number, fromId: number): Buffer {
  const nonce = Buffer.alloc(16, 0);
  nonce.writeUInt32LE(packetId, 0);
  // bytes 4-7 = 0 (upper 32 of uint64 packet ID)
  nonce.writeUInt32LE(fromId, 8);
  // bytes 12-15 = 0
  return nonce;
}

function decrypt(ciphertext: Buffer, key: Buffer, nonce: Buffer): Buffer | null {
  const algo = key.length === 32 ? 'aes-256-ctr' : 'aes-128-ctr';
  try {
    const decipher = crypto.createDecipheriv(algo, key, nonce);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return null;
  }
}

// ─── Protobuf heuristics ────────────────────────────────────────────────────

function looksLikeProtobuf(buf: Buffer): boolean {
  if (buf.length < 2) return false;
  const wireType = buf[0] & 0x07;
  const fieldNum = buf[0] >> 3;
  return fieldNum >= 1 && fieldNum <= 15 && [0, 1, 2, 5].includes(wireType);
}

interface ProtoField {
  field: number;
  type: string;
  value?: number;
  length?: number;
  string?: string | null;
  hex?: string;
}

function parseProtobuf(buf: Buffer): ProtoField[] {
  const fields: ProtoField[] = [];
  let i = 0;
  try {
    while (i < buf.length) {
      const tag = buf[i++];
      const wireType = tag & 0x07;
      const fieldNum = tag >> 3;
      if (fieldNum === 0) break;

      if (wireType === 0) { // varint
        let val = 0, shift = 0;
        while (i < buf.length) {
          const b = buf[i++];
          val |= (b & 0x7f) << shift;
          shift += 7;
          if (!(b & 0x80)) break;
        }
        fields.push({ field: fieldNum, type: 'varint', value: val });
      } else if (wireType === 2) { // length-delimited
        let len = 0, shift = 0;
        while (i < buf.length) {
          const b = buf[i++];
          len |= (b & 0x7f) << shift;
          shift += 7;
          if (!(b & 0x80)) break;
        }
        if (i + len > buf.length) break;
        const bytes = buf.slice(i, i + len);
        i += len;
        let strVal: string | null = null;
        const s = bytes.toString('utf8');
        if (s.length > 0 && [...s].every(c => c.charCodeAt(0) >= 0x20 || '\n\r\t'.includes(c))) {
          strVal = s;
        }
        fields.push({ field: fieldNum, type: 'bytes', length: len, string: strVal, hex: bytes.toString('hex').toUpperCase() });
      } else if (wireType === 5) { // fixed32
        if (i + 4 > buf.length) break;
        fields.push({ field: fieldNum, type: 'fixed32', hex: buf.slice(i, i + 4).toString('hex').toUpperCase() });
        i += 4;
      } else if (wireType === 1) { // fixed64
        if (i + 8 > buf.length) break;
        fields.push({ field: fieldNum, type: 'fixed64', hex: buf.slice(i, i + 8).toString('hex').toUpperCase() });
        i += 8;
      } else {
        break;
      }
    }
  } catch { /* best effort */ }
  return fields;
}

// Meshtastic Data portnum enum (field 1 of Data message)
const PORTNUMS: Record<number, string> = {
  1: 'TEXT_MESSAGE', 2: 'REMOTE_HARDWARE', 3: 'POSITION',
  4: 'NODEINFO', 5: 'ROUTING', 6: 'ADMIN', 7: 'TEXT_MESSAGE_COMPRESSED',
  8: 'WAYPOINT', 32: 'REPLY', 33: 'IP_TUNNEL', 34: 'PAXCOUNTER',
  64: 'SERIAL', 65: 'STORE_FORWARD', 66: 'RANGE_TEST', 67: 'TELEMETRY',
  68: 'ZPS', 69: 'SIMULATOR', 70: 'TRACEROUTE', 71: 'NEIGHBORINFO',
  72: 'ATAK_PLUGIN', 73: 'MAP_REPORT', 256: 'PRIVATE', 257: 'ATAK_FORWARDER',
};

const HW_MODELS: Record<number, string> = {
  1: 'TLORA_V2', 2: 'TLORA_V1', 3: 'TLORA_V2_1_1P6', 4: 'TBEAM',
  5: 'HELTEC_V2_0', 6: 'TBEAM_V0P7', 7: 'T_ECHO', 8: 'TLORA_V1_1P3',
  9: 'RAK4631', 10: 'HELTEC_V2_1', 25: 'TBEAM_S3_CORE', 39: 'RAK11200',
  40: 'NANO_G1', 41: 'TLORA_V2_1_1P8', 43: 'STATION_G1', 44: 'RAK11310',
  47: 'HELTEC_V3', 48: 'HELTEC_WSL_V3', 58: 'TBEAM_S3', 110: 'HELTEC_V3',
};

export interface NodeInfo {
  id?: string;
  longName?: string;
  shortName?: string;
  hwModel?: string;
  hwModelId?: number;
  role?: number;
}

export interface Position {
  latitudeI?: number;
  longitudeI?: number;
  altitude?: number;
  time?: number;
  latitude?: number;
  longitude?: number;
}

function parseNodeInfo(buf: Buffer): NodeInfo {
  const fields = parseProtobuf(buf);
  const info: NodeInfo = {};
  for (const f of fields) {
    if (f.field === 1 && f.type === 'bytes' && f.string) info.id = f.string;
    if (f.field === 2 && f.type === 'bytes' && f.string) info.longName = f.string;
    if (f.field === 3 && f.type === 'bytes' && f.string) info.shortName = f.string;
    if (f.field === 5 && f.type === 'varint') {
      info.hwModelId = f.value;
      info.hwModel = HW_MODELS[f.value!] ?? `UNKNOWN_${f.value}`;
    }
    if (f.field === 7 && f.type === 'varint') info.role = f.value;
  }
  return info;
}

function parsePosition(buf: Buffer): Position {
  const fields = parseProtobuf(buf);
  const pos: Position = {};
  for (const f of fields) {
    // Position proto: field 1=latitudeI (sfixed32), field 2=longitudeI (sfixed32),
    // field 3=altitude (int32), field 9=time (fixed32)
    if (f.field === 1 && f.type === 'fixed32') pos.latitudeI = Buffer.from(f.hex!, 'hex').readInt32LE(0);
    if (f.field === 2 && f.type === 'fixed32') pos.longitudeI = Buffer.from(f.hex!, 'hex').readInt32LE(0);
    if (f.field === 3 && f.type === 'varint') pos.altitude = f.value;
    if (f.field === 9 && f.type === 'fixed32') pos.time = Buffer.from(f.hex!, 'hex').readUInt32LE(0);
    // Also handle varint encoding for lat/lon (zigzag)
    if (f.field === 1 && f.type === 'varint') pos.latitudeI = (f.value! >>> 1) ^ -(f.value! & 1);
    if (f.field === 2 && f.type === 'varint') pos.longitudeI = (f.value! >>> 1) ^ -(f.value! & 1);
  }
  if (pos.latitudeI) pos.latitude = pos.latitudeI / 1e7;
  if (pos.longitudeI) pos.longitude = pos.longitudeI / 1e7;
  return pos;
}

// ─── Frame decoder ──────────────────────────────────────────────────────────

export interface DecodedFrame {
  from: string;
  to: string;
  packetId: string;
  hopLimit: number;
  hopStart: number;
  wantAck: boolean;
  viaMqtt: boolean;
  channelHash: number;
  decrypted: boolean;
  pskUsed?: string;
  portnum?: string;
  portnumId?: number;
  payload?: string;
  text?: string;
  nodeInfo?: NodeInfo;
  position?: Position;
  telemetry?: { voltage?: number; batteryLevel?: number; channelUtil?: number; airUtilTx?: number; uptime?: number };
  fields?: ProtoField[];
  raw: string;
}

export function decodeFrame(hex: string): DecodedFrame {
  const raw = Buffer.from(hex.replace(/\s/g, ''), 'hex');
  const to       = raw.readUInt32LE(0);
  const from     = raw.readUInt32LE(4);
  const packetId = raw.readUInt32LE(8);
  const flags    = raw[12];
  const chHash   = raw[13];

  const hopLimit = flags & 0x07;
  const wantAck  = !!(flags & 0x08);
  const viaMqtt  = !!(flags & 0x10);
  const hopStart = (flags >> 5) & 0x07;

  const result: DecodedFrame = {
    from: `0x${from.toString(16).toUpperCase().padStart(8, '0')}`,
    to: to === 0xFFFFFFFF ? 'broadcast' : `0x${to.toString(16).toUpperCase().padStart(8, '0')}`,
    packetId: `0x${packetId.toString(16).toUpperCase().padStart(8, '0')}`,
    hopLimit,
    hopStart,
    wantAck,
    viaMqtt,
    channelHash: chHash,
    decrypted: false,
    raw: hex,
  };

  if (raw.length <= 16) return result;

  const ciphertext = raw.slice(16);
  const nonce = buildNonce(packetId, from);

  // Try all known PSKs, prioritizing matching channel hash
  const sorted = [...PSK_TABLE].sort((a, b) => {
    const aMatch = a.hash === chHash ? 0 : 1;
    const bMatch = b.hash === chHash ? 0 : 1;
    return aMatch - bMatch;
  });

  for (const psk of sorted) {
    const plain = decrypt(ciphertext, psk.key, nonce);
    if (!plain) continue;

    if (looksLikeProtobuf(plain)) {
      const fields = parseProtobuf(plain);
      result.decrypted = true;
      result.pskUsed = psk.name;
      result.fields = fields;

      // Meshtastic Data message: field 1 = portnum, field 2 = payload bytes
      const portnumField = fields.find(f => f.field === 1 && f.type === 'varint');
      const payloadField = fields.find(f => f.field === 2 && f.type === 'bytes');

      if (portnumField?.value !== undefined) {
        result.portnumId = portnumField.value;
        result.portnum = PORTNUMS[portnumField.value] ?? `UNKNOWN_${portnumField.value}`;
      }
      if (payloadField?.hex) {
        result.payload = payloadField.hex;
        const payloadBuf = Buffer.from(payloadField.hex, 'hex');
        if (result.portnumId === 1 && payloadField.string) {
          result.text = payloadField.string;
        } else if (result.portnumId === 4) {
          result.nodeInfo = parseNodeInfo(payloadBuf);
        } else if (result.portnumId === 3) {
          result.position = parsePosition(payloadBuf);
        } else if (result.portnumId === 67) {
          // Telemetry: field 2 = DeviceMetrics sub-message
          const telFields = parseProtobuf(payloadBuf);
          const metricsField = telFields.find(f => f.field === 2 && f.type === 'bytes');
          if (metricsField?.hex) {
            const dm = parseProtobuf(Buffer.from(metricsField.hex, 'hex'));
            result.telemetry = {};
            for (const f of dm) {
              if (f.field === 1 && f.type === 'varint') result.telemetry.batteryLevel = f.value;
              if (f.field === 2 && f.type === 'fixed32') result.telemetry.voltage = Buffer.from(f.hex!, 'hex').readFloatLE(0);
              if (f.field === 3 && f.type === 'fixed32') result.telemetry.channelUtil = Buffer.from(f.hex!, 'hex').readFloatLE(0);
              if (f.field === 4 && f.type === 'fixed32') result.telemetry.airUtilTx = Buffer.from(f.hex!, 'hex').readFloatLE(0);
              if (f.field === 5 && f.type === 'varint') result.telemetry.uptime = f.value;
            }
          }
        }
      }
      break;
    }
  }

  return result;
}

// ─── Brute-force channel name ───────────────────────────────────────────────

/** Try common channel names to find one whose hash matches. */
export function guessChannelName(chHash: number, key: Buffer = defaultKey): string[] {
  const COMMON_NAMES = [
    'LongFast', 'LongSlow', 'MediumFast', 'MediumSlow', 'ShortFast', 'ShortSlow',
    'admin', 'test', 'default', 'mesh', 'local', 'ham', 'emergency',
    'private', 'group', 'family', 'friends', 'work', 'home', 'base',
  ];
  return COMMON_NAMES.filter(name => channelHash(name, key) === chHash);
}

// ─── CLI mode ───────────────────────────────────────────────────────────────

function printDecoded(d: DecodedFrame): void {
  console.log(`  from=${d.from} to=${d.to} id=${d.packetId}`);
  console.log(`  hopLimit=${d.hopLimit} hopStart=${d.hopStart} wantAck=${d.wantAck} viaMqtt=${d.viaMqtt}`);
  console.log(`  channelHash=0x${d.channelHash.toString(16).padStart(2, '0')}`);

  const guesses = guessChannelName(d.channelHash);
  if (guesses.length) console.log(`  possible channel names: ${guesses.join(', ')}`);

  if (d.decrypted) {
    console.log(`  ✓ DECRYPTED with: ${d.pskUsed}`);
    if (d.portnum) console.log(`  portnum: ${d.portnum} (${d.portnumId})`);
    if (d.text) console.log(`  text: "${d.text}"`);
    if (d.nodeInfo) {
      const ni = d.nodeInfo;
      console.log(`  nodeInfo:`);
      if (ni.id) console.log(`    id: ${ni.id}`);
      if (ni.longName) console.log(`    longName: "${ni.longName}"`);
      if (ni.shortName) console.log(`    shortName: "${ni.shortName}"`);
      if (ni.hwModel) console.log(`    hardware: ${ni.hwModel} (${ni.hwModelId})`);
      if (ni.role !== undefined) console.log(`    role: ${ni.role}`);
    }
    if (d.position) {
      const p = d.position;
      console.log(`  position:`);
      if (p.latitude !== undefined) console.log(`    lat: ${p.latitude}`);
      if (p.longitude !== undefined) console.log(`    lon: ${p.longitude}`);
      if (p.altitude !== undefined) console.log(`    alt: ${p.altitude}m`);
      if (p.time) console.log(`    time: ${new Date(p.time * 1000).toISOString()}`);
    }
    if (d.payload) console.log(`  payload: ${d.payload}`);
  } else {
    console.log(`  ✗ Could not decrypt with known PSKs (private channel)`);
  }
}

// ─── Live mode: connect to MQTT bridge WebSocket ────────────────────────────

async function runLive(): Promise<void> {
  const WS_URL = process.env.BLACKBOXMESH_MQTT_WS ?? 'ws://localhost:8081/ws';
  const WebSocket = (await import('ws')).default;

  console.log(`[decoder] Connecting to ${WS_URL}...`);
  const ws = new WebSocket(WS_URL);

  ws.on('open', () => console.log('[decoder] Connected. Listening for meshtastic frames...'));
  ws.on('error', (e: Error) => console.error('[decoder] WS error:', e.message));
  ws.on('close', () => { console.error('[decoder] WS closed, exiting'); process.exit(1); });

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'node_report' && msg.data?.type === 'meshtastic_observed') {
        const hex = msg.data.payload;
        if (!hex) return;
        console.log(`\n[${new Date().toLocaleTimeString()}] RSSI=${msg.data.rssi} SNR=${msg.data.snr} ${msg.data.length}B`);
        const decoded = decodeFrame(hex);
        printDecoded(decoded);
      }
    } catch { /* ignore non-JSON */ }
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--live')) {
    runLive();
  } else if (args.length > 0) {
    // CLI mode: decode hex frames passed as arguments
    console.log('Meshtastic Frame Decoder\n');
    for (const hex of args.filter(a => !a.startsWith('--'))) {
      console.log(`[frame ${hex.length / 2}B]`);
      const decoded = decodeFrame(hex);
      printDecoded(decoded);
      console.log();
    }
  } else {
    console.log('Usage:');
    console.log('  npx ts-node meshtastic-decoder.ts <hex> [<hex> ...]   # decode frames');
    console.log('  npx ts-node meshtastic-decoder.ts --live              # listen to MQTT bridge');
    console.log();
    console.log('Example:');
    console.log('  npx ts-node meshtastic-decoder.ts FFFFFFFF3C72C604A68E8B6E6308003C53BFFA7BAE921FBF...');
  }
}
