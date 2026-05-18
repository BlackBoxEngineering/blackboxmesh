/**
 * Browser-side Meshtastic frame decoder.
 * Uses Web Crypto API (AES-CTR) — no Node.js dependencies.
 */

const DEFAULT_KEY_B64 = '1PG7OiApB1nwvP+rz05pAQ==';
const LEGACY_KEY_B64 = 'AQ==';

const PORTNUMS: Record<number, string> = {
  1: 'TEXT_MESSAGE', 3: 'POSITION', 4: 'NODEINFO', 5: 'ROUTING',
  67: 'TELEMETRY', 70: 'TRACEROUTE', 71: 'NEIGHBORINFO',
};

export interface DecodedMtrx {
  from: string;
  to: string;
  packetId: string;
  channelHash: number;
  hopLimit: number;
  decrypted: boolean;
  portnum?: string;
  portnumId?: number;
  text?: string;
  nodeInfo?: { id?: string; longName?: string; shortName?: string; hwModel?: number };
  position?: { latitude?: number; longitude?: number; altitude?: number };
  telemetry?: { voltage?: number; batteryLevel?: number; channelUtil?: number; airUtilTx?: number; uptime?: number };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function expandKey(b64: string): Uint8Array {
  const raw = b64ToBytes(b64);
  if (raw.length >= 16) return raw.slice(0, 16);
  const key = new Uint8Array(16);
  key.set(raw);
  return key;
}

function readU32LE(buf: Uint8Array, offset: number): number {
  return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
}

function readI32LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24);
}

function readF32LE(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getFloat32(offset, true);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, '');
  const arr = new Uint8Array(clean.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

async function aesCtrDecrypt(ciphertext: Uint8Array, keyBytes: Uint8Array, nonce: Uint8Array): Promise<Uint8Array | null> {
  try {
    const key = await crypto.subtle.importKey('raw', keyBytes.buffer as ArrayBuffer, { name: 'AES-CTR' }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-CTR', counter: nonce.buffer as ArrayBuffer, length: 128 }, key, ciphertext.buffer as ArrayBuffer);
    return new Uint8Array(plain);
  } catch {
    return null;
  }
}

function looksLikeProtobuf(buf: Uint8Array): boolean {
  if (buf.length < 2) return false;
  const wireType = buf[0] & 0x07;
  const fieldNum = buf[0] >> 3;
  return fieldNum >= 1 && fieldNum <= 15 && [0, 1, 2, 5].includes(wireType);
}

interface PbField {
  field: number;
  wireType: number;
  varint?: number;
  bytes?: Uint8Array;
}

function parseProtobuf(buf: Uint8Array): PbField[] {
  const fields: PbField[] = [];
  let i = 0;
  try {
    while (i < buf.length) {
      const tag = buf[i++];
      const wireType = tag & 0x07;
      const fieldNum = tag >> 3;
      if (fieldNum === 0) break;

      if (wireType === 0) {
        let val = 0, shift = 0;
        while (i < buf.length) {
          const b = buf[i++];
          val |= (b & 0x7f) << shift;
          shift += 7;
          if (!(b & 0x80)) break;
        }
        fields.push({ field: fieldNum, wireType, varint: val });
      } else if (wireType === 2) {
        let len = 0, shift = 0;
        while (i < buf.length) {
          const b = buf[i++];
          len |= (b & 0x7f) << shift;
          shift += 7;
          if (!(b & 0x80)) break;
        }
        if (i + len > buf.length) break;
        fields.push({ field: fieldNum, wireType, bytes: buf.slice(i, i + len) });
        i += len;
      } else if (wireType === 5) {
        if (i + 4 > buf.length) break;
        fields.push({ field: fieldNum, wireType, bytes: buf.slice(i, i + 4) });
        i += 4;
      } else if (wireType === 1) {
        if (i + 8 > buf.length) break;
        fields.push({ field: fieldNum, wireType, bytes: buf.slice(i, i + 8) });
        i += 8;
      } else {
        break;
      }
    }
  } catch { /* best effort */ }
  return fields;
}

const KEYS = [expandKey(DEFAULT_KEY_B64), expandKey(LEGACY_KEY_B64)];

export async function decodeMtrxFrame(hex: string): Promise<DecodedMtrx> {
  const raw = hexToBytes(hex);
  const to = readU32LE(raw, 0);
  const from = readU32LE(raw, 4);
  const packetId = readU32LE(raw, 8);
  const flags = raw[12];
  const chHash = raw[13];

  const result: DecodedMtrx = {
    from: `0x${from.toString(16).toUpperCase().padStart(8, '0')}`,
    to: to === 0xFFFFFFFF ? 'broadcast' : `0x${to.toString(16).toUpperCase().padStart(8, '0')}`,
    packetId: `0x${packetId.toString(16).toUpperCase().padStart(8, '0')}`,
    channelHash: chHash,
    hopLimit: flags & 0x07,
    decrypted: false,
  };

  if (raw.length <= 16) return result;

  const ciphertext = raw.slice(16);
  const nonce = new Uint8Array(16);
  nonce[0] = packetId & 0xff;
  nonce[1] = (packetId >> 8) & 0xff;
  nonce[2] = (packetId >> 16) & 0xff;
  nonce[3] = (packetId >> 24) & 0xff;
  nonce[8] = from & 0xff;
  nonce[9] = (from >> 8) & 0xff;
  nonce[10] = (from >> 16) & 0xff;
  nonce[11] = (from >> 24) & 0xff;

  for (const key of KEYS) {
    const plain = await aesCtrDecrypt(ciphertext, key, nonce);
    if (!plain || !looksLikeProtobuf(plain)) continue;

    result.decrypted = true;
    const fields = parseProtobuf(plain);

    const portnumF = fields.find(f => f.field === 1 && f.wireType === 0);
    const payloadF = fields.find(f => f.field === 2 && f.wireType === 2);

    if (portnumF?.varint !== undefined) {
      result.portnumId = portnumF.varint;
      result.portnum = PORTNUMS[portnumF.varint] ?? `UNKNOWN_${portnumF.varint}`;
    }

    if (payloadF?.bytes) {
      if (result.portnumId === 1) {
        result.text = new TextDecoder().decode(payloadF.bytes);
      } else if (result.portnumId === 4) {
        const ni = parseProtobuf(payloadF.bytes);
        result.nodeInfo = {};
        for (const f of ni) {
          if (f.field === 1 && f.bytes) result.nodeInfo.id = new TextDecoder().decode(f.bytes);
          if (f.field === 2 && f.bytes) result.nodeInfo.longName = new TextDecoder().decode(f.bytes);
          if (f.field === 3 && f.bytes) result.nodeInfo.shortName = new TextDecoder().decode(f.bytes);
          if (f.field === 5 && f.varint !== undefined) result.nodeInfo.hwModel = f.varint;
        }
      } else if (result.portnumId === 3) {
        const pos = parseProtobuf(payloadF.bytes);
        result.position = {};
        for (const f of pos) {
          if (f.field === 1 && f.wireType === 5 && f.bytes) result.position.latitude = readI32LE(f.bytes, 0) / 1e7;
          if (f.field === 2 && f.wireType === 5 && f.bytes) result.position.longitude = readI32LE(f.bytes, 0) / 1e7;
          if (f.field === 3 && f.varint !== undefined) result.position.altitude = f.varint;
        }
      } else if (result.portnumId === 67) {
        // Telemetry: outer message has field 1=time(fixed32), field 2=DeviceMetrics(bytes)
        const telFields = parseProtobuf(payloadF.bytes);
        const metricsF = telFields.find(f => f.field === 2 && f.wireType === 2);
        if (metricsF?.bytes) {
          const dm = parseProtobuf(metricsF.bytes);
          result.telemetry = {};
          for (const f of dm) {
            // DeviceMetrics: 1=batteryLevel(varint), 2=voltage(float/fixed32),
            // 3=channelUtilization(float/fixed32), 4=airUtilTx(float/fixed32), 5=uptimeSeconds(varint)
            if (f.field === 1 && f.varint !== undefined) result.telemetry.batteryLevel = f.varint;
            if (f.field === 2 && f.wireType === 5 && f.bytes) result.telemetry.voltage = readF32LE(f.bytes, 0);
            if (f.field === 3 && f.wireType === 5 && f.bytes) result.telemetry.channelUtil = readF32LE(f.bytes, 0);
            if (f.field === 4 && f.wireType === 5 && f.bytes) result.telemetry.airUtilTx = readF32LE(f.bytes, 0);
            if (f.field === 5 && f.varint !== undefined) result.telemetry.uptime = f.varint;
          }
        }
      }
    }
    break;
  }

  return result;
}
