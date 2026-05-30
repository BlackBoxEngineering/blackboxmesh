export type MessageStatus = 'ok' | 'decrypt_failed' | 'parse_failed';
export type MessageDirection = 'in' | 'out';
export type MessageTransport = 'blackboxmesh' | 'meshtastic';

export interface NormalizedMessage {
  id: string;
  timestampMs: number;
  direction: MessageDirection;
  transport: MessageTransport;
  channelId: string;
  from?: string;
  to?: string;
  text?: string;
  payloadHex?: string;
  rssi?: number;
  snr?: number;
  status: MessageStatus;
  isAlert?: boolean;
}

