/**
 * Singleton store for Meshtastic observed data from Web Serial.
 * Survives RadioView unmount/remount. Feeds the map with decoded positions.
 */
import { decodeMtrxFrame, type DecodedMtrx } from './meshtasticDecoder';
import type { MeshtasticNode, MeshtasticMessage } from './types';

export interface MtrxRecord {
  ts: number;
  rssi: number;
  snr: number;
  payload: string;
  decoded?: DecodedMtrx;
}

const MAX_LOG = 200;

class MeshtasticStore {
  private _mtrxLog: MtrxRecord[] = [];
  private _nodes: Map<string, MeshtasticNode> = new Map();
  private _messages: MeshtasticMessage[] = [];
  private _logCbs: Array<(log: MtrxRecord[]) => void> = [];
  private _nodeCbs: Array<(nodes: MeshtasticNode[]) => void> = [];
  private _msgCbs: Array<(msgs: MeshtasticMessage[]) => void> = [];

  get mtrxLog(): MtrxRecord[] { return this._mtrxLog; }
  get nodes(): MeshtasticNode[] { return Array.from(this._nodes.values()); }
  get messages(): MeshtasticMessage[] { return this._messages; }

  async ingestFrame(rssi: number, snr: number, payload: string): Promise<void> {
    const rec: MtrxRecord = { ts: Date.now(), rssi, snr, payload };
    this._mtrxLog = [...this._mtrxLog.slice(-(MAX_LOG - 1)), rec];
    this.emitLog();

    const decoded = await decodeMtrxFrame(payload);
    rec.decoded = decoded;
    this._mtrxLog = [...this._mtrxLog]; // trigger re-render
    this.emitLog();

    if (!decoded.decrypted) return;

    // Update node store
    const nodeId = decoded.from;
    const prev = this._nodes.get(nodeId);
    const updated: MeshtasticNode = {
      id: nodeId,
      longName: decoded.nodeInfo?.longName ?? prev?.longName,
      shortName: decoded.nodeInfo?.shortName ?? prev?.shortName,
      hwModel: decoded.nodeInfo?.hwModel != null ? `HW_${decoded.nodeInfo.hwModel}` : prev?.hwModel,
      latitude: decoded.position?.latitude ?? prev?.latitude,
      longitude: decoded.position?.longitude ?? prev?.longitude,
      altitude: decoded.position?.altitude ?? prev?.altitude,
      rssi,
      snr,
      lastSeen: Date.now(),
    };
    this._nodes.set(nodeId, updated);
    this.emitNodes();

    // Store text messages
    if (decoded.text) {
      const msg: MeshtasticMessage = {
        id: decoded.packetId,
        from: nodeId,
        to: decoded.to,
        text: decoded.text,
        timestamp: Date.now(),
        rssi,
        snr,
      };
      this._messages = [...this._messages.slice(-(MAX_LOG - 1)), msg];
      this.emitMessages();
    }
  }

  clear(): void {
    this._mtrxLog = [];
    this._nodes.clear();
    this._messages = [];
    this.emitLog();
    this.emitNodes();
    this.emitMessages();
  }

  onLog(cb: (log: MtrxRecord[]) => void): () => void {
    this._logCbs.push(cb);
    cb(this._mtrxLog);
    return () => { this._logCbs = this._logCbs.filter(x => x !== cb); };
  }

  onNodes(cb: (nodes: MeshtasticNode[]) => void): () => void {
    this._nodeCbs.push(cb);
    cb(this.nodes);
    return () => { this._nodeCbs = this._nodeCbs.filter(x => x !== cb); };
  }

  onMessages(cb: (msgs: MeshtasticMessage[]) => void): () => void {
    this._msgCbs.push(cb);
    cb(this._messages);
    return () => { this._msgCbs = this._msgCbs.filter(x => x !== cb); };
  }

  private emitLog() { for (const cb of this._logCbs) cb(this._mtrxLog); }
  private emitNodes() { const n = this.nodes; for (const cb of this._nodeCbs) cb(n); }
  private emitMessages() { for (const cb of this._msgCbs) cb(this._messages); }
}

export const meshtasticStore = new MeshtasticStore();

// Debug: expose store on window for console inspection
if (typeof window !== 'undefined') (window as any).__meshtasticStore = meshtasticStore;
