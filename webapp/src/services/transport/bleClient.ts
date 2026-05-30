import type { BnTransport, TransportEvent, TransportStatus } from './types';

const NORDIC_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // write
const NORDIC_UART_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // notify

type BluetoothRemoteGATTCharacteristicLike = {
  value?: DataView | null;
  startNotifications(): Promise<void>;
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
  addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
  removeEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
};

type BluetoothRemoteGATTServiceLike = {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristicLike>;
};

type BluetoothRemoteGATTServerLike = {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServerLike>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTServiceLike>;
};

type BluetoothDeviceLike = {
  gatt?: BluetoothRemoteGATTServerLike | null;
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
  removeEventListener(type: 'gattserverdisconnected', listener: () => void): void;
};

interface NavigatorWithBluetooth extends Navigator {
  bluetooth: {
    requestDevice(options?: unknown): Promise<BluetoothDeviceLike>;
  };
}

export class BleClient implements BnTransport {
  public readonly kind = 'ble' as const;

  private device: BluetoothDeviceLike | null = null;
  private server: BluetoothRemoteGATTServerLike | null = null;
  private txChar: BluetoothRemoteGATTCharacteristicLike | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristicLike | null = null;
  private status: TransportStatus = 'idle';
  private statusCbs: Array<(s: TransportStatus) => void> = [];
  private eventCbs: Array<(e: TransportEvent) => void> = [];
  private nodeId: string | null = null;
  private readBuffer = '';
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public getStatus(): TransportStatus {
    return this.status;
  }

  public getNodeId(): string | null {
    return this.nodeId;
  }

  public onStatus(cb: (s: TransportStatus) => void): () => void {
    this.statusCbs.push(cb);
    return () => {
      this.statusCbs = this.statusCbs.filter((x) => x !== cb);
    };
  }

  public onEvent(cb: (e: TransportEvent) => void): () => void {
    this.eventCbs.push(cb);
    return () => {
      this.eventCbs = this.eventCbs.filter((x) => x !== cb);
    };
  }

  public async connect(): Promise<void> {
    if (!this.isSupported()) throw new Error('Web Bluetooth is not supported in this browser.');
    if (this.status === 'connected' || this.status === 'connecting' || this.status === 'requesting_device') return;

    this.setStatus('requesting_device');
    try {
      const nav = navigator as NavigatorWithBluetooth;
      this.device = await nav.bluetooth.requestDevice({
        filters: [{ services: [NORDIC_UART_SERVICE] }],
        optionalServices: [NORDIC_UART_SERVICE],
      });
    } catch (error) {
      this.setStatus('disconnected');
      throw error;
    }

    await this.connectGatt();
  }

  public async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    if (this.device) this.device.removeEventListener('gattserverdisconnected', this.onGattDisconnected);
    try {
      if (this.server?.connected) this.server.disconnect();
    } catch {
      // ignore
    }
    this.server = null;
    this.txChar = null;
    this.rxChar = null;
    this.nodeId = null;
    this.setStatus('disconnected');
  }

  public async sendLine(line: string): Promise<void> {
    if (!this.rxChar) throw new Error('BLE transport not connected');
    const payload = new TextEncoder().encode(line.endsWith('\n') ? line : `${line}\n`);
    await this.rxChar.writeValueWithoutResponse(payload);
  }

  private async connectGatt(): Promise<void> {
    if (!this.device) throw new Error('No BLE device selected');
    this.setStatus('connecting');
    const server = await this.device.gatt?.connect();
    if (!server) throw new Error('Failed to connect GATT server');

    this.server = server;
    const service = await server.getPrimaryService(NORDIC_UART_SERVICE);
    this.rxChar = await service.getCharacteristic(NORDIC_UART_RX);
    this.txChar = await service.getCharacteristic(NORDIC_UART_TX);
    await this.txChar.startNotifications();
    this.txChar.addEventListener('characteristicvaluechanged', this.onValueChanged);

    this.device.addEventListener('gattserverdisconnected', this.onGattDisconnected);
    this.reconnectAttempts = 0;
    this.setStatus('connected');
  }

  private onGattDisconnected = (): void => {
    this.txChar?.removeEventListener('characteristicvaluechanged', this.onValueChanged);
    this.txChar = null;
    this.rxChar = null;
    this.server = null;
    this.nodeId = null;

    this.reconnectAttempts += 1;
    if (this.reconnectAttempts > 3 || !this.device) {
      this.setStatus('failed');
      return;
    }

    this.setStatus('reconnecting');
    const delayMs = Math.min(5000, 1000 * this.reconnectAttempts);
    this.reconnectTimer = window.setTimeout(() => {
      void this.connectGatt().catch(() => {
        this.setStatus('failed');
      });
    }, delayMs);
  };

  private onValueChanged = (event: Event): void => {
    const target = event.target as BluetoothRemoteGATTCharacteristicLike | null;
    const value = target?.value;
    if (!value) return;
    this.readBuffer += new TextDecoder().decode(value.buffer);

    let nl: number;
    while ((nl = this.readBuffer.indexOf('\n')) >= 0) {
      const line = this.readBuffer.slice(0, nl).replace(/\r$/, '').trim();
      this.readBuffer = this.readBuffer.slice(nl + 1);
      if (!line) continue;
      this.handleLine(line);
    }
  };

  private handleLine(line: string): void {
    if (line.startsWith('BN READY ')) {
      this.nodeId = line.slice(9).trim();
      this.emit({ raw: line, kind: 'ready', data: { nodeId: this.nodeId } });
      return;
    }
    if (line.startsWith('BN RX ')) {
      const parts = line.slice(6).trim().split(/\s+/);
      if (parts.length >= 7) {
        this.emit({
          raw: line,
          kind: 'rx',
          data: {
            from: parts[0],
            to: parts[1],
            type: Number(parts[2]),
            hops: Number(parts[3]),
            rssi: Number(parts[4]),
            snr: Number(parts[5]),
            payload: parts[6],
          },
        });
      }
      return;
    }
    if (line.startsWith('BN MTRX ')) {
      const parts = line.slice(8).trim().split(/\s+/);
      if (parts.length >= 3) {
        this.emit({
          raw: line,
          kind: 'mtrx',
          data: { rssi: Number(parts[0]), snr: Number(parts[1]), payload: parts[2] },
        });
      }
      return;
    }
    if (line.startsWith('BN STATUS ')) {
      try {
        this.emit({ raw: line, kind: 'status', data: JSON.parse(line.slice(10)) });
      } catch {
        this.emit({ raw: line, kind: 'other' });
      }
      return;
    }
    this.emit({ raw: line, kind: 'other' });
  }

  private emit(event: TransportEvent): void {
    for (const cb of this.eventCbs) {
      try { cb(event); } catch (error) { console.error('[bleClient] event cb error', error); }
    }
  }

  private setStatus(status: TransportStatus): void {
    this.status = status;
    for (const cb of this.statusCbs) {
      try { cb(status); } catch (error) { console.error('[bleClient] status cb error', error); }
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const bleClient = new BleClient();
