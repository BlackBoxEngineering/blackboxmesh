import type { DecodedMtrx } from '../meshtasticDecoder';
import type { NormalizedMessage } from './types';

function buildId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function fromBnRx(input: {
  ts: number;
  from: string;
  to: string;
  payload: string;
  rssi: number;
  snr: number;
}): NormalizedMessage {
  return {
    id: buildId('bnrx'),
    timestampMs: input.ts,
    direction: 'in',
    transport: 'blackboxmesh',
    channelId: 'blackboxmesh',
    from: input.from,
    to: input.to,
    payloadHex: input.payload,
    rssi: input.rssi,
    snr: input.snr,
    status: 'ok',
  };
}

export function fromMeshtasticFrame(input: {
  ts: number;
  payload: string;
  rssi: number;
  snr: number;
  decoded?: DecodedMtrx;
}): NormalizedMessage {
  const d = input.decoded;
  const status: NormalizedMessage['status'] = !d
    ? 'parse_failed'
    : d.decrypted
      ? 'ok'
      : 'decrypt_failed';

  return {
    id: d?.packetId || buildId('mtrx'),
    timestampMs: input.ts,
    direction: 'in',
    transport: 'meshtastic',
    channelId: 'meshtastic-longfast',
    from: d?.from,
    to: d?.to,
    text: d?.text,
    payloadHex: input.payload,
    rssi: input.rssi,
    snr: input.snr,
    status,
  };
}

export function fromOutgoingBnCommand(input: { ts: number; line: string }): NormalizedMessage | null {
  const line = input.line.trim();
  if (line.startsWith('BN BCAST ')) {
    return {
      id: buildId('out'),
      timestampMs: input.ts,
      direction: 'out',
      transport: 'blackboxmesh',
      channelId: 'blackboxmesh',
      to: 'broadcast',
      text: line.slice('BN BCAST '.length),
      status: 'ok',
    };
  }

  if (line.startsWith('BN TX ')) {
    const parts = line.split(/\s+/);
    if (parts.length >= 5) {
      return {
        id: buildId('out'),
        timestampMs: input.ts,
        direction: 'out',
        transport: 'blackboxmesh',
        channelId: 'blackboxmesh',
        to: parts[2],
        payloadHex: parts[4],
        status: 'ok',
      };
    }
  }

  return null;
}

