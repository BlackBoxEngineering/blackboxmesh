import type { SerialEvent } from '../serialClient';

export type TransportKind = 'usb_serial' | 'ble';

export type TransportStatus =
  | 'idle'
  | 'requesting_device'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export type TransportEvent = SerialEvent;

export interface BnTransport {
  kind: TransportKind;
  isSupported(): boolean;
  getStatus(): TransportStatus;
  getNodeId(): string | null;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  tryAutoReconnect?(): Promise<boolean>;
  sendLine(line: string): Promise<void>;
  onStatus(cb: (s: TransportStatus) => void): () => void;
  onEvent(cb: (e: TransportEvent) => void): () => void;
}

