import { useEffect, useMemo, useRef, useState } from 'react';
import { callEnDeCom } from '../services/encryption';
import { serialClient, type SerialEvent, type SerialStatus } from '../services/serialClient';
import { meshtasticStore, type MtrxRecord } from '../services/meshtasticStore';

type Tab = 'messages' | 'peers' | 'sniffer' | 'telemetry' | 'console';

interface RxRecord {
  ts: number;
  from: string;
  to: string;
  type: number;
  hops: number;
  rssi: number;
  snr: number;
  payload: string;
}

interface ParsedMeshtasticFrame {
  to: string;
  from: string;
  packetId: string;
  flags: string;
  hopLimit: number;
  channelHash: string;
  nextHop: string;
  relayNode: string;
  payloadBytes: number;
  kind: string;
}

interface PeerInfo {
  id: string;
  lastSeen: number;
  bestRssi: number;
  bestSnr: number;
  minHops: number;
  count: number;
}

const MAX_LOG = 200;

function hexEncode(s: string): string {
  return Array.from(new TextEncoder().encode(s))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexDecode(hex: string): string {
  try {
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) ?? []);
    return new TextDecoder().decode(bytes);
  } catch {
    return hex;
  }
}

function parseMeshtasticFrame(hex: string): ParsedMeshtasticFrame | null {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length < 32) return null;
  const bytes = clean.match(/.{2}/g)?.map((b) => parseInt(b, 16));
  if (!bytes || bytes.length < 16 || bytes.some((b) => !Number.isFinite(b))) return null;

  const u32le = (offset: number) =>
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>> 0;

  const hex8 = (value: number) => `0x${value.toString(16).toUpperCase().padStart(8, '0')}`;
  const hex2 = (value: number) => `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
  const to = u32le(0);
  const flags = bytes[12] ?? 0;
  const payloadBytes = Math.max(0, bytes.length - 16);

  return {
    to: hex8(to),
    from: hex8(u32le(4)),
    packetId: hex8(u32le(8)),
    flags: hex2(flags),
    hopLimit: flags & 0x07,
    channelHash: hex2(bytes[13] ?? 0),
    nextHop: hex2(bytes[14] ?? 0),
    relayNode: hex2(bytes[15] ?? 0),
    payloadBytes,
    kind: to === 0xffffffff ? 'broadcast' : 'direct',
  };
}

export function RadioView() {
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('radioTab') as Tab) || 'messages');
  const [status, setStatus] = useState<SerialStatus>(serialClient.getStatus());
  const [nodeId, setNodeId] = useState<string | null>(serialClient.getNodeId());
  const [rxLog, setRxLog] = useState<RxRecord[]>([]);
  const [mtrxLog, setMtrxLog] = useState<MtrxRecord[]>(meshtasticStore.mtrxLog);
  const [rawLog, setRawLog] = useState<{ ts: number; dir: 'in' | 'out'; line: string }[]>([]);
  const [lastStatus, setLastStatus] = useState<Record<string, unknown> | null>(null);
  const [observerMode, setObserverMode] = useState(() => localStorage.getItem('observerMode') === 'true');
  const [observerEnabledAt, setObserverEnabledAt] = useState<number | null>(() => {
    const v = localStorage.getItem('observerEnabledAt');
    return v ? Number(v) : null;
  });

  // Subscribe to meshtastic store for persistent log
  useEffect(() => meshtasticStore.onLog(setMtrxLog), []);

  // Auto-restore observer mode on reconnect (only once per mount)
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (status === 'connected' && observerMode && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      serialClient.sendLine('BN MESH ON').catch(() => {});
    }
    if (status !== 'connected') hasRestoredRef.current = false;
  }, [status, observerMode]);

  // Subscribe to serial events.
  useEffect(() => {
    const offStatus = serialClient.onStatus(setStatus);
    const offEvent = serialClient.onEvent((e: SerialEvent) => {
      setRawLog((prev) => [...prev.slice(-MAX_LOG + 1), { ts: Date.now(), dir: 'in', line: e.raw }]);
      switch (e.kind) {
        case 'ready':
          setNodeId(serialClient.getNodeId());
          break;
        case 'rx':
          if (e.data) setRxLog((prev) => [...prev.slice(-MAX_LOG + 1), { ts: Date.now(), ...(e.data as Omit<RxRecord, 'ts'>) }]);
          break;
        case 'mtrx':
          if (e.data) {
            const { rssi, snr, payload } = e.data as { rssi: number; snr: number; payload: string };
            meshtasticStore.ingestFrame(rssi, snr, payload);
          }
          break;
        case 'status':
          if (e.data) setLastStatus(e.data as Record<string, unknown>);
          break;
      }
    });
    return () => { offStatus(); offEvent(); };
  }, []);

  const peers: PeerInfo[] = useMemo(() => {
    const m = new Map<string, PeerInfo>();
    for (const r of rxLog) {
      const existing = m.get(r.from);
      if (!existing) {
        m.set(r.from, { id: r.from, lastSeen: r.ts, bestRssi: r.rssi, bestSnr: r.snr, minHops: r.hops, count: 1 });
      } else {
        existing.lastSeen = Math.max(existing.lastSeen, r.ts);
        existing.bestRssi = Math.max(existing.bestRssi, r.rssi);
        existing.bestSnr = Math.max(existing.bestSnr, r.snr);
        existing.minHops = Math.min(existing.minHops, r.hops);
        existing.count += 1;
      }
    }
    return Array.from(m.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  }, [rxLog]);

  const lastRssi = rxLog.length > 0 ? rxLog[rxLog.length - 1].rssi : undefined;
  const lastSnr = rxLog.length > 0 ? rxLog[rxLog.length - 1].snr : undefined;

  const send = async (line: string) => {
    setRawLog((prev) => [...prev.slice(-MAX_LOG + 1), { ts: Date.now(), dir: 'out', line }]);
    try {
      await serialClient.sendLine(line);
    } catch (e) {
      console.warn('[radio] send failed', e);
    }
  };

  const disabled = status !== 'connected';

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl">Radio</h2>
        <div className="text-xs text-gray-400">
          <span className={status === 'connected' ? 'text-green-400' : 'text-gray-500'}>● </span>
          {status === 'connected' ? `Connected ${nodeId ?? ''}` : status === 'connecting' ? 'Connecting…' : 'Not connected — use sidebar → Radio → Connect'}
        </div>
      </div>

      {/* Live stats header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <Stat label="RX packets" value={rxLog.length} />
        <Stat label="Observed (Meshtastic)" value={mtrxLog.length} />
        <Stat label="Last RSSI" value={lastRssi != null ? `${lastRssi} dBm` : '—'} />
        <Stat label="Last SNR" value={lastSnr != null ? `${lastSnr} dB` : '—'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700 mb-4 text-sm">
        {(['messages', 'peers', 'sniffer', 'telemetry', 'console'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); localStorage.setItem('radioTab', t); }}
            className={`px-3 py-2 rounded-t transition-colors ${
              tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'messages' && <MessagesTab disabled={disabled} rxLog={rxLog} send={send} />}
      {tab === 'peers' && <PeersTab peers={peers} />}
      {tab === 'sniffer' && (
        <SnifferTab
          disabled={disabled}
          observerMode={observerMode}
          observerEnabledAt={observerEnabledAt}
          mtrxLog={mtrxLog}
          rawLog={rawLog}
          onToggle={async () => {
            const next = !observerMode;
            setObserverMode(next);
            localStorage.setItem('observerMode', String(next));
            const ts = next ? Date.now() : null;
            setObserverEnabledAt(ts);
            localStorage.setItem('observerEnabledAt', ts ? String(ts) : '');
            await send(next ? 'BN MESH ON' : 'BN MESH OFF');
          }}
        />
      )}
      {tab === 'telemetry' && (
        <TelemetryTab disabled={disabled} lastStatus={lastStatus} send={send} />
      )}
      {tab === 'console' && <ConsoleTab disabled={disabled} rawLog={rawLog} send={send} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-700 p-3 rounded">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-lg font-mono">{value}</div>
    </div>
  );
}

// ---- Messages --------------------------------------------------------------

function MessagesTab({
  disabled,
  rxLog,
  send,
}: {
  disabled: boolean;
  rxLog: RxRecord[];
  send: (line: string) => Promise<void>;
}) {
  const [target, setTarget] = useState('broadcast');
  const [msgType, setMsgType] = useState(1);
  const [text, setText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const onSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    setSendError('');
    try {
      let payload = text.trim();
      if (password.trim()) {
        const result = await callEnDeCom(payload, password.trim());
        if (result.status === 'error') {
          setSendError(result.message);
          return;
        }
        payload = result.message;
      }
      const hex = hexEncode(payload);
      if (target === 'broadcast') {
        await send(`BN BCAST ${payload}`);
      } else {
        await send(`BN TX ${target} ${msgType} ${hex}`);
      }
      setText('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-gray-700 p-3 rounded">
        <div className="flex gap-2 mb-2 text-xs">
          <input
            className="bg-gray-800 px-2 py-1 rounded flex-1 font-mono"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="broadcast or 0xNNNNNNNN"
          />
          <input
            type="number"
            className="bg-gray-800 px-2 py-1 rounded w-20 font-mono"
            value={msgType}
            onChange={(e) => setMsgType(Number(e.target.value) || 0)}
            placeholder="type"
          />
        </div>
        <div className="flex gap-2">
          <input
            className="bg-gray-800 px-2 py-1 rounded flex-1 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder={target === 'broadcast' ? 'Broadcast a message to the mesh…' : `DM ${target}…`}
            disabled={disabled || sending}
          />
          <button
            onClick={() => setShowPassword((v) => !v)}
            disabled={disabled || sending}
            className={`px-3 py-1 rounded disabled:bg-gray-600 disabled:cursor-not-allowed text-sm ${
              showPassword || password.trim()
                ? 'bg-yellow-700 text-yellow-100 hover:bg-yellow-600'
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
            title="Encrypt with shared password"
          >
            🔒
          </button>
          <button
            onClick={onSend}
            disabled={disabled || sending || !text.trim()}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-sm"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
        {showPassword && (
          <div className="mt-2">
            <input
              type="password"
              className="bg-gray-800 px-2 py-1 rounded w-full text-sm border border-yellow-700/70"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Shared password — recipient needs this to decrypt"
              disabled={disabled || sending}
            />
          </div>
        )}
        {sendError && <div className="mt-2 text-xs text-red-400">{sendError}</div>}
      </div>

      <div className="bg-gray-700 rounded max-h-96 overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <thead className="sticky top-0 bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left p-2">time</th>
              <th className="text-left p-2">from</th>
              <th className="text-left p-2">to</th>
              <th className="text-left p-2">rssi</th>
              <th className="text-left p-2">hops</th>
              <th className="text-left p-2">payload</th>
            </tr>
          </thead>
          <tbody>
            {rxLog.slice().reverse().map((r, i) => (
              <tr key={`${r.ts}-${i}`} className="border-t border-gray-800">
                <td className="p-2 text-gray-400">{new Date(r.ts).toLocaleTimeString()}</td>
                <td className="p-2 text-blue-400">{r.from}</td>
                <td className="p-2">{r.to}</td>
                <td className="p-2">{r.rssi}</td>
                <td className="p-2">{r.hops}</td>
                <td className="p-2 max-w-xs"><MessageCell payload={r.payload} /></td>
              </tr>
            ))}
            {rxLog.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center text-gray-500">No frames received yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MessageCell({ payload }: { payload: string }) {
  const text = hexDecode(payload);
  const [showDecrypt, setShowDecrypt] = useState(false);
  const [password, setPassword] = useState('');
  const [decrypted, setDecrypted] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!text.startsWith('V2:')) {
    return <span className="break-words" title={payload}>{text}</span>;
  }

  const decrypt = async () => {
    if (!password.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await callEnDeCom(text, password.trim());
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      setDecrypted(result.message);
      setShowDecrypt(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decrypt message');
    } finally {
      setBusy(false);
    }
  };

  if (decrypted) {
    return (
      <span className="text-green-300 break-words">
        🔓 {decrypted}{' '}
        <button
          className="text-gray-400 hover:text-white"
          onClick={() => {
            setDecrypted('');
            setPassword('');
            setError('');
          }}
          title="Reset decrypted message"
        >
          ✕
        </button>
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-yellow-300">
        🔒 encrypted{' '}
        <button className="underline hover:text-yellow-100" onClick={() => setShowDecrypt((v) => !v)}>
          decrypt
        </button>
      </div>
      {showDecrypt && (
        <div className="flex gap-1">
          <input
            type="password"
            className="bg-gray-800 px-1 py-0.5 rounded flex-1 min-w-0 text-xs"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && decrypt()}
            placeholder="password"
          />
          <button
            onClick={decrypt}
            disabled={busy || !password.trim()}
            className="px-2 py-0.5 rounded bg-green-700 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            🔓
          </button>
        </div>
      )}
      {error && <div className="text-red-400">{error}</div>}
    </div>
  );
}

// ---- Peers -----------------------------------------------------------------

function PeersTab({ peers }: { peers: PeerInfo[] }) {
  return (
    <div className="bg-gray-700 rounded max-h-[28rem] overflow-y-auto">
      <table className="w-full text-xs font-mono">
        <thead className="sticky top-0 bg-gray-800 text-gray-400">
          <tr>
            <th className="text-left p-2">node id</th>
            <th className="text-left p-2">last seen</th>
            <th className="text-left p-2">best rssi</th>
            <th className="text-left p-2">best snr</th>
            <th className="text-left p-2">min hops</th>
            <th className="text-left p-2">frames</th>
          </tr>
        </thead>
        <tbody>
          {peers.map((p) => (
            <tr key={p.id} className="border-t border-gray-800">
              <td className="p-2 text-blue-400">{p.id}</td>
              <td className="p-2 text-gray-400">{new Date(p.lastSeen).toLocaleTimeString()}</td>
              <td className="p-2">{p.bestRssi} dBm</td>
              <td className="p-2">{p.bestSnr} dB</td>
              <td className="p-2">{p.minHops}</td>
              <td className="p-2">{p.count}</td>
            </tr>
          ))}
          {peers.length === 0 && (
            <tr><td colSpan={6} className="p-4 text-center text-gray-500">No peers seen yet. Frames are aggregated as they arrive.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---- Sniffer ---------------------------------------------------------------

function SnifferTab({
  disabled,
  observerMode,
  observerEnabledAt,
  mtrxLog,
  rawLog,
  onToggle,
}: {
  disabled: boolean;
  observerMode: boolean;
  observerEnabledAt: number | null;
  mtrxLog: MtrxRecord[];
  rawLog: { ts: number; dir: 'in' | 'out'; line: string }[];
  onToggle: () => void;
}) {
  const lastFrameTs = mtrxLog.length > 0 ? mtrxLog[mtrxLog.length - 1].ts : null;
  const activity = rawLog.filter((r) => /MESH|MTRX|BN OK|BN ERR/.test(r.line)).slice(-12).reverse();
  return (
    <div className="space-y-3">
      <div className="bg-gray-700 p-3 rounded flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Meshtastic Observer</div>
          <div className="text-xs text-gray-400">Passive RX of LongFast EU868 frames. Radio does not transmit in this mode.</div>
        </div>
        <button
          onClick={onToggle}
          disabled={disabled}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            observerMode ? 'bg-red-700 hover:bg-red-600' : 'bg-green-700 hover:bg-green-600'
          } disabled:bg-gray-600 disabled:cursor-not-allowed`}
        >
          {observerMode ? 'Disable' : 'Enable'}
        </button>
      </div>

      <div className="bg-gray-800 p-2 rounded text-xs font-mono text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
        <span>state: <span className={observerMode ? 'text-green-400' : 'text-gray-500'}>{observerMode ? 'listening' : 'idle'}</span></span>
        <span>enabled at: {observerEnabledAt ? new Date(observerEnabledAt).toLocaleTimeString() : '—'}</span>
        <span>frames: {mtrxLog.length}</span>
        <span>last frame: {lastFrameTs ? new Date(lastFrameTs).toLocaleTimeString() : 'none'}</span>
      </div>

      <div className="bg-gray-800 rounded text-xs font-mono">
        <div className="px-2 py-1 text-gray-400 border-b border-gray-700">Activity</div>
        <div className="p-2 space-y-0.5 max-h-32 overflow-y-auto">
          {activity.map((r, i) => (
            <div key={`${r.ts}-${i}`} className="flex gap-2">
              <span className="text-gray-500">{new Date(r.ts).toLocaleTimeString()}</span>
              <span className={r.dir === 'out' ? 'text-blue-400' : 'text-green-400'}>{r.dir === 'out' ? '→' : '←'}</span>
              <span className="text-gray-200 truncate" title={r.line}>{r.line}</span>
            </div>
          ))}
          {activity.length === 0 && (
            <div className="text-gray-500">No observer activity yet.</div>
          )}
        </div>
      </div>

      <div className="bg-gray-700 rounded max-h-96 overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <thead className="sticky top-0 bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left p-2">time</th>
              <th className="text-left p-2">rssi</th>
              <th className="text-left p-2">snr</th>
              <th className="text-left p-2">from</th>
              <th className="text-left p-2">to</th>
              <th className="text-left p-2">id</th>
              <th className="text-left p-2">ch</th>
              <th className="text-left p-2">decoded</th>
              <th className="text-left p-2">hex</th>
            </tr>
          </thead>
          <tbody>
            {mtrxLog.slice().reverse().map((r, i) => {
              const parsed = parseMeshtasticFrame(r.payload);
              const d = r.decoded;
              let decodedCell = <span className="text-gray-500">{parsed ? `${parsed.payloadBytes}B encrypted` : 'unknown'}</span>;
              if (d?.decrypted) {
                if (d.text) {
                  decodedCell = <span className="text-green-300">💬 {d.text}</span>;
                } else if (d.nodeInfo?.longName) {
                  decodedCell = <span className="text-cyan-300">👤 {d.nodeInfo.longName} ({d.nodeInfo.shortName})</span>;
                } else if (d.position?.latitude != null) {
                  decodedCell = <span className="text-yellow-300">📍 {d.position.latitude.toFixed(5)}, {d.position.longitude?.toFixed(5)}</span>;
                } else {
                  decodedCell = <span className="text-blue-300">{d.portnum ?? 'decrypted'}</span>;
                }
              }
              return (
                <tr key={`${r.ts}-${i}`} className="border-t border-gray-800">
                  <td className="p-2 text-gray-400">{new Date(r.ts).toLocaleTimeString()}</td>
                  <td className="p-2">{r.rssi}</td>
                  <td className="p-2">{r.snr}</td>
                  <td className="p-2 text-blue-300">{d?.from ?? parsed?.from ?? '?'}</td>
                  <td className="p-2">{d?.to ?? (parsed ? `${parsed.kind}:${parsed.to}` : '?')}</td>
                  <td className="p-2">{d?.packetId ?? parsed?.packetId ?? '?'}</td>
                  <td className="p-2">{parsed?.channelHash ?? '?'}</td>
                  <td className="p-2 max-w-xs truncate">{decodedCell}</td>
                  <td
                    className="p-2 max-w-[120px] cursor-pointer hover:text-yellow-300 transition-colors truncate"
                    title="Click to copy full hex"
                    onClick={() => navigator.clipboard.writeText(r.payload)}
                  >
                    {r.payload.slice(0, 24)}…
                  </td>
                </tr>
              );
            })}
            {mtrxLog.length === 0 && (
              <tr><td colSpan={9} className="p-4 text-center text-gray-500">{observerMode ? 'Listening… no frames yet.' : 'Observer disabled.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Telemetry -------------------------------------------------------------

function TelemetryTab({
  disabled,
  lastStatus,
  send,
}: {
  disabled: boolean;
  lastStatus: Record<string, unknown> | null;
  send: (line: string) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => send('BN BEACON')}
          disabled={disabled}
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-sm"
        >
          Beacon now
        </button>
        <button
          onClick={() => send('BN STATUS?')}
          disabled={disabled}
          className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 disabled:cursor-not-allowed text-sm"
        >
          Request status
        </button>
      </div>

      <div className="bg-gray-700 p-3 rounded">
        <div className="text-sm font-medium mb-2">Last STATUS</div>
        {lastStatus ? (
          <pre className="text-xs font-mono text-green-300 overflow-x-auto">{JSON.stringify(lastStatus, null, 2)}</pre>
        ) : (
          <div className="text-xs text-gray-500">No status received yet. Click "Request status".</div>
        )}
      </div>

      <div className="bg-gray-700 p-3 rounded text-xs text-gray-400 space-y-1">
        <div className="font-medium text-gray-300">Not yet wired (firmware extensions):</div>
        <div>• Sensor broadcasts — needs I²C peripheral + <code>BN SENSE</code></div>
      </div>
    </div>
  );
}

// ---- Console ---------------------------------------------------------------

function ConsoleTab({
  disabled,
  rawLog,
  send,
}: {
  disabled: boolean;
  rawLog: { ts: number; dir: 'in' | 'out'; line: string }[];
  send: (line: string) => Promise<void>;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [rawLog]);

  const onSubmit = async () => {
    const line = input.trim();
    if (!line) return;
    await send(line);
    setInput('');
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="bg-gray-800 px-2 py-1 rounded flex-1 text-xs font-mono"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder="BN STATUS?   |   BN BEACON   |   BN MESH ON …"
          disabled={disabled}
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !input.trim()}
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-sm"
        >
          Send
        </button>
      </div>

      <div ref={scrollRef} className="bg-black rounded p-2 max-h-96 overflow-y-auto text-xs font-mono">
        {rawLog.length === 0 ? (
          <div className="text-gray-500">Raw serial in/out will appear here.</div>
        ) : (
          rawLog.map((r, i) => (
            <div key={`${r.ts}-${i}`} className={r.dir === 'in' ? 'text-green-300' : 'text-blue-300'}>
              <span className="text-gray-500">{new Date(r.ts).toLocaleTimeString()} </span>
              <span className="text-gray-500">{r.dir === 'in' ? '<' : '>'}</span> {r.line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
