import { serialClient } from '../serialClient';
import { bleClient } from './bleClient';
import type { BnTransport, TransportEvent, TransportKind, TransportStatus } from './types';

class SerialTransportAdapter implements BnTransport {
  public readonly kind = 'usb_serial' as const;

  public isSupported(): boolean {
    return serialClient.isSupported();
  }

  public getStatus(): TransportStatus {
    const status = serialClient.getStatus();
    if (status === 'connected') return 'connected';
    if (status === 'connecting') return 'connecting';
    if (status === 'error') return 'failed';
    return 'disconnected';
  }

  public getNodeId(): string | null {
    return serialClient.getNodeId();
  }

  public async connect(): Promise<void> {
    await serialClient.connect();
  }

  public async disconnect(): Promise<void> {
    await serialClient.disconnect();
  }

  public async tryAutoReconnect(): Promise<boolean> {
    return serialClient.tryAutoReconnect();
  }

  public async sendLine(line: string): Promise<void> {
    await serialClient.sendLine(line);
  }

  public onStatus(cb: (s: TransportStatus) => void): () => void {
    return serialClient.onStatus(() => cb(this.getStatus()));
  }

  public onEvent(cb: (e: TransportEvent) => void): () => void {
    return serialClient.onEvent(cb);
  }
}

type StatusCb = (s: TransportStatus) => void;
type EventCb = (e: TransportEvent) => void;

class RadioTransportManager {
  private readonly transports: Record<TransportKind, BnTransport> = {
    usb_serial: new SerialTransportAdapter(),
    ble: bleClient,
  };
  private active: TransportKind = 'usb_serial';
  private status: TransportStatus = this.transports.usb_serial.getStatus();
  private nodeId: string | null = this.transports.usb_serial.getNodeId();
  private statusCbs: StatusCb[] = [];
  private eventCbs: EventCb[] = [];
  private offStatus: (() => void) | null = null;
  private offEvent: (() => void) | null = null;

  constructor() {
    this.bindActiveTransport();
  }

  public getActiveTransport(): TransportKind {
    return this.active;
  }

  public getStatus(): TransportStatus {
    return this.status;
  }

  public getNodeId(): string | null {
    return this.nodeId;
  }

  public isSupported(kind: TransportKind): boolean {
    return this.transports[kind].isSupported();
  }

  public onStatus(cb: StatusCb): () => void {
    this.statusCbs.push(cb);
    return () => {
      this.statusCbs = this.statusCbs.filter((x) => x !== cb);
    };
  }

  public onEvent(cb: EventCb): () => void {
    this.eventCbs.push(cb);
    return () => {
      this.eventCbs = this.eventCbs.filter((x) => x !== cb);
    };
  }

  public async tryAutoReconnectUsb(): Promise<boolean> {
    if (!this.transports.usb_serial.tryAutoReconnect) return false;
    const ok = await this.transports.usb_serial.tryAutoReconnect();
    if (ok) {
      this.active = 'usb_serial';
      this.bindActiveTransport();
      this.pushStatus(this.transports.usb_serial.getStatus());
      this.nodeId = this.transports.usb_serial.getNodeId();
    }
    return ok;
  }

  public async connect(kind: TransportKind): Promise<void> {
    if (kind !== this.active) {
      await this.disconnect();
      this.active = kind;
      this.bindActiveTransport();
    }
    await this.transports[kind].connect();
    this.nodeId = this.transports[kind].getNodeId();
    this.pushStatus(this.transports[kind].getStatus());
  }

  public async disconnect(): Promise<void> {
    await this.transports[this.active].disconnect();
    this.nodeId = null;
    this.pushStatus(this.transports[this.active].getStatus());
  }

  public async sendLine(line: string): Promise<void> {
    await this.transports[this.active].sendLine(line);
  }

  private bindActiveTransport(): void {
    this.offStatus?.();
    this.offEvent?.();
    const transport = this.transports[this.active];
    this.offStatus = transport.onStatus((status) => {
      this.nodeId = transport.getNodeId();
      this.pushStatus(status);
    });
    this.offEvent = transport.onEvent((event) => {
      if (event.kind === 'ready') {
        this.nodeId = transport.getNodeId();
      }
      for (const cb of this.eventCbs) {
        try { cb(event); } catch (error) { console.error('[radioTransport] event cb error', error); }
      }
    });
  }

  private pushStatus(status: TransportStatus): void {
    this.status = status;
    for (const cb of this.statusCbs) {
      try { cb(status); } catch (error) { console.error('[radioTransport] status cb error', error); }
    }
  }
}

export const radioTransportManager = new RadioTransportManager();

