import { connectWebSocket, getNodes } from './mqttBridge';
import type { BlackBoxMeshNode } from './types';

export type MeshStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class MeshClient {
  private status: MeshStatus = 'disconnected';
  private nodes: Map<string, BlackBoxMeshNode> = new Map();
  private ws: WebSocket | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private statusCbs: Array<(s: MeshStatus) => void> = [];
  private nodesCbs: Array<(nodes: BlackBoxMeshNode[]) => void> = [];

  public getStatus(): MeshStatus {
    return this.status;
  }

  public getNodes(): BlackBoxMeshNode[] {
    return Array.from(this.nodes.values());
  }

  public onStatus(cb: (s: MeshStatus) => void): () => void {
    this.statusCbs.push(cb);
    cb(this.status);
    return () => { this.statusCbs = this.statusCbs.filter((x) => x !== cb); };
  }

  public onNodes(cb: (nodes: BlackBoxMeshNode[]) => void): () => void {
    this.nodesCbs.push(cb);
    cb(this.getNodes());
    return () => { this.nodesCbs = this.nodesCbs.filter((x) => x !== cb); };
  }

  public upsertNode(node: Partial<BlackBoxMeshNode> & { id: string }): void {
    const prev = this.nodes.get(node.id);
    this.nodes.set(node.id, {
      id: node.id,
      latitude: node.latitude ?? prev?.latitude,
      longitude: node.longitude ?? prev?.longitude,
      rssi: node.rssi ?? prev?.rssi,
      snr: node.snr ?? prev?.snr,
      lastSeen: node.lastSeen ?? Date.now(),
      routes: node.routes ?? prev?.routes ?? [],
    });
    this.emitNodes();
  }

  /**
   * Ingest a BN RX event from the local radio so peers we hear directly
   * over LoRa show up in the mesh node store even when the MQTT hub is down.
   * Position is decoded for MSG_POSITION (type 0x03); other types only
   * refresh rssi/snr/lastSeen.
   */
  public ingestRadioRx(rx: { from: string; type: number; rssi: number; snr: number; payload: string }): void {
    const id = normalizeNodeId(rx.from);
    if (!id) return;
    const prev = this.nodes.get(id);
    let latitude = prev?.latitude;
    let longitude = prev?.longitude;
    if (rx.type === 0x03) {
      const pos = decodePositionPayload(rx.payload);
      if (pos) {
        latitude = pos.latitude;
        longitude = pos.longitude;
      }
    }
    const merged: BlackBoxMeshNode = {
      id,
      latitude,
      longitude,
      rssi: Number.isFinite(rx.rssi) ? rx.rssi : prev?.rssi,
      snr: Number.isFinite(rx.snr) ? rx.snr : prev?.snr,
      lastSeen: Date.now(),
      routes: prev?.routes ?? [],
    };
    this.nodes.set(id, merged);
    this.emitNodes();
  }

  public async connect(): Promise<void> {
    if (this.status === 'connected' || this.status === 'connecting') return;
    this.setStatus('connecting');
    try {
      await this.startPoll();
      this.openWs();
      localStorage.setItem('meshClient.autoConnect', 'true');
    } catch {
      this.setStatus('error');
    }
  }

  public disconnect(): void {
    localStorage.setItem('meshClient.autoConnect', 'false');
    this.teardown();
    this.nodes.clear();
    this.emitNodes();
    this.setStatus('disconnected');
  }

  public async tryAutoReconnect(): Promise<boolean> {
    if (localStorage.getItem('meshClient.autoConnect') !== 'true') return false;
    try {
      await this.connect();
      return true;
    } catch {
      return false;
    }
  }

  // ---- internal ----------------------------------------------------------

  private async startPoll(): Promise<void> {
    const data = await getNodes();
    if (Array.isArray(data)) {
      for (const node of data) this.upsert(node);
      this.emitNodes();
    }
    this.pollInterval = setInterval(async () => {
      try {
        const fresh = await getNodes();
        if (Array.isArray(fresh)) {
          for (const node of fresh) this.upsert(node);
          this.emitNodes();
        }
      } catch { /* bridge offline — keep last state */ }
    }, 5000);
  }

  private openWs(): void {
    try {
      this.ws = connectWebSocket((msg) => {
        const payload = msg && msg.type === 'node_report' ? msg.data : msg;
        if (!payload || !payload.id) return;
        const prev = this.nodes.get(payload.id);
        const merged: Partial<BlackBoxMeshNode> & { id: string } = {
          id: payload.id,
          latitude: payload.latitude ?? prev?.latitude,
          longitude: payload.longitude ?? prev?.longitude,
          rssi: payload.rssi ?? prev?.rssi,
          snr: payload.snr ?? prev?.snr,
          lastSeen: Date.now(),
          routes: Array.isArray(payload.routes) ? payload.routes : (prev?.routes ?? []),
        };
        this.upsertNode(merged);
      });
      this.ws.onopen = () => this.setStatus('connected');
      this.ws.onerror = () => this.setStatus('error');
      this.ws.onclose = () => {
        if (this.status !== 'disconnected') this.setStatus('error');
      };
    } catch {
      this.setStatus('error');
    }
  }

  private teardown(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private upsert(node: BlackBoxMeshNode): void {
    const prev = this.nodes.get(node.id);
    this.nodes.set(node.id, { ...prev, ...node, lastSeen: node.lastSeen ?? Date.now() });
  }

  private emitNodes(): void {
    const snapshot = this.getNodes();
    for (const cb of this.nodesCbs) {
      try { cb(snapshot); } catch (err) { console.error('[meshClient] nodes cb error', err); }
    }
  }

  private setStatus(s: MeshStatus): void {
    this.status = s;
    for (const cb of this.statusCbs) {
      try { cb(s); } catch (err) { console.error('[meshClient] status cb error', err); }
    }
  }
}

export const meshClient = new MeshClient();

// ---- helpers --------------------------------------------------------------

const BLACKBOXMESH_HEADER_HEX_LENGTH = 32;

function normalizeNodeId(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  // Firmware emits hex with or without 0x prefix; coerce to upper-case 0xXXXXXXXX.
  const hex = s.replace(/^0x/i, '').toUpperCase();
  if (!/^[0-9A-F]{1,8}$/.test(hex)) return s;
  return `0x${hex.padStart(8, '0')}`;
}

function decodePositionPayload(hex: string): { latitude: number; longitude: number } | null {
  // PositionMessage layout (LE, packed): int32 lat*1e7, int32 lon*1e7, int32 alt, uint8 sats = 13 bytes
  // We only need the first 8 bytes.
  if (!hex || hex.length < 16) return null;
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const payloadOffset = clean.length >= BLACKBOXMESH_HEADER_HEX_LENGTH + 16 ? BLACKBOXMESH_HEADER_HEX_LENGTH : 0;
  if (clean.length < payloadOffset + 16) return null;
  try {
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      const byteOffset = payloadOffset + i * 2;
      bytes[i] = parseInt(clean.slice(byteOffset, byteOffset + 2), 16);
    }
    const view = new DataView(bytes.buffer);
    const latE7 = view.getInt32(0, true);
    const lonE7 = view.getInt32(4, true);
    const latitude = latE7 / 1e7;
    const longitude = lonE7 / 1e7;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    if (latitude === 0 && longitude === 0) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}
