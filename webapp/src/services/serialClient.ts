/**
 * BlackBoxMesh Serial client.
 *
 * Talks directly to a Heltec WiFi LoRa 32 V3 over USB CDC from the browser.
 * Replaces the Node-side `serial-bridge.ts` for end users — no local
 * service needed, just a Chromium browser with Web Serial API support.
 *
 * Line protocol (matches firmware/main.cpp):
 *   host -> fw:   BN GPS <lat> <lon> <acc>
 *                 BN TX  <to> <type> <hex>
 *                 BN BCAST <text>
 *                 BN BEACON
 *                 BN STATUS?
 *                 BN MESH ON|OFF
 *   fw -> host:   BN READY <nodeId>
 *                 BN RX <from> <to> <type> <hops> <rssi> <snr> <hex>
 *                 BN MTRX <rssi> <snr> <hex>
 *                 BN STATUS <json>
 */

// Minimal Web Serial typings — sidesteps needing a separate @types package.
type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
};

interface NavigatorWithSerial extends Navigator {
  serial: {
    requestPort(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<SerialPortLike>;
    getPorts(): Promise<SerialPortLike[]>;
  };
}

export type SerialStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SerialEvent {
  raw: string;
  kind: 'ready' | 'rx' | 'mtrx' | 'status' | 'other';
  data?: unknown;
}

const BAUD = 115200;
// CP210x VID/PID used by the Heltec dev board. Filters are a hint to the
// browser's port picker — the user can still pick any port.
const CP210X_VID = 0x10c4;
const CP210X_PID = 0xea60;

export class SerialClient {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buffer = '';
  private status: SerialStatus = 'disconnected';
  private statusCbs: Array<(s: SerialStatus) => void> = [];
  private eventCbs: Array<(e: SerialEvent) => void> = [];
  private nodeId: string | null = null;
  private readLoopActive = false;

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public getStatus(): SerialStatus {
    return this.status;
  }

  public getNodeId(): string | null {
    return this.nodeId;
  }

  public onStatus(cb: (s: SerialStatus) => void): () => void {
    this.statusCbs.push(cb);
    return () => {
      this.statusCbs = this.statusCbs.filter((x) => x !== cb);
    };
  }

  public onEvent(cb: (e: SerialEvent) => void): () => void {
    this.eventCbs.push(cb);
    return () => {
      this.eventCbs = this.eventCbs.filter((x) => x !== cb);
    };
  }

  /** Try to silently re-attach to a previously authorised port. */
  public async tryAutoReconnect(): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (localStorage.getItem('serialClient.autoConnect') !== 'true') return false;
    const nav = navigator as NavigatorWithSerial;
    const ports = await nav.serial.getPorts();
    if (ports.length === 0) return false;
    try {
      await this.openPort(ports[0]);
      return true;
    } catch {
      return false;
    }
  }

  /** Prompt the user to pick a port and open it. */
  public async connect(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Web Serial API not supported. Use Chrome, Edge, or another Chromium browser.');
    }
    if (this.status === 'connected' || this.status === 'connecting') return;

    this.setStatus('connecting');
    const nav = navigator as NavigatorWithSerial;
    let port: SerialPortLike;
    try {
      port = await nav.serial.requestPort({
        filters: [{ usbVendorId: CP210X_VID, usbProductId: CP210X_PID }],
      });
    } catch (e) {
      // User cancelled the picker or no device selected.
      this.setStatus('disconnected');
      throw e;
    }
    await this.openPort(port);
    localStorage.setItem('serialClient.autoConnect', 'true');
  }

  public async disconnect(): Promise<void> {
    localStorage.setItem('serialClient.autoConnect', 'false');
    this.readLoopActive = false;
    await this.releaseResources();
    this.setStatus('disconnected');
  }

  public async sendLine(line: string): Promise<void> {
    if (!this.writer) throw new Error('Serial port not connected');
    const data = new TextEncoder().encode(line.endsWith('\n') ? line : line + '\n');
    await this.writer.write(data);
  }

  // ---- internal ---------------------------------------------------------

  private async openPort(port: SerialPortLike): Promise<void> {
    try {
      await port.open({ baudRate: BAUD });
    } catch (e) {
      this.setStatus('error');
      throw e;
    }
    this.port = port;
    if (!port.readable || !port.writable) {
      this.setStatus('error');
      throw new Error('Serial port has no readable/writable stream');
    }
    this.reader = port.readable.getReader();
    this.writer = port.writable.getWriter();
    this.setStatus('connected');
    this.readLoopActive = true;
    void this.readLoop();
  }

  private async readLoop(): Promise<void> {
    const decoder = new TextDecoder();
    let errored = false;
    try {
      while (this.readLoopActive && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (!value) continue;
        this.buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = this.buffer.indexOf('\n')) >= 0) {
          const line = this.buffer.slice(0, nl).replace(/\r$/, '').trim();
          this.buffer = this.buffer.slice(nl + 1);
          if (line) this.handleLine(line);
        }
      }
    } catch (e) {
      console.warn('[serialClient] read loop error', e);
      errored = true;
    }
    // The stream is gone (device unplugged, port closed, or fatal read error).
    // Release every handle so a subsequent connect() can re-open the port
    // without hitting "port is already open" / locked-stream errors.
    this.readLoopActive = false;
    await this.releaseResources();
    this.setStatus(errored ? 'error' : 'disconnected');
  }

  private async releaseResources(): Promise<void> {
    if (this.reader) {
      try { await this.reader.cancel(); } catch { /* ignore */ }
      try { this.reader.releaseLock(); } catch { /* ignore */ }
      this.reader = null;
    }
    if (this.writer) {
      try { await this.writer.close(); } catch { /* ignore */ }
      try { this.writer.releaseLock(); } catch { /* ignore */ }
      this.writer = null;
    }
    if (this.port) {
      try { await this.port.close(); } catch { /* ignore */ }
      this.port = null;
    }
    this.buffer = '';
    this.nodeId = null;
  }

  private handleLine(line: string): void {
    // Mirror serial-bridge.ts parsing.
    if (line.startsWith('BN READY ')) {
      this.nodeId = line.slice(9).trim();
      console.log('[serialClient] device ready, nodeId=', this.nodeId);
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
        const status = JSON.parse(line.slice(10));
        this.emit({ raw: line, kind: 'status', data: status });
      } catch {
        this.emit({ raw: line, kind: 'other' });
      }
      return;
    }
    this.emit({ raw: line, kind: 'other' });
  }

  private emit(e: SerialEvent): void {
    for (const cb of this.eventCbs) {
      try { cb(e); } catch (err) { console.error('[serialClient] event cb error', err); }
    }
  }

  private setStatus(s: SerialStatus): void {
    this.status = s;
    for (const cb of this.statusCbs) {
      try { cb(s); } catch (err) { console.error('[serialClient] status cb error', err); }
    }
  }
}

export const serialClient = new SerialClient();
