import { useMemo, useState } from 'react';
import { messageStore } from '../services/messages/messageStore';
import type { NormalizedMessage } from '../services/messages/types';
import { useEffect } from 'react';

type ChannelFilter = 'all' | 'blackboxmesh' | 'meshtastic-longfast';

function useMessages(): NormalizedMessage[] {
  const [messages, setMessages] = useState<NormalizedMessage[]>(() => messageStore.getAll());
  useEffect(() => messageStore.onMessages(setMessages), []);
  return messages;
}

function statusClass(status: NormalizedMessage['status']): string {
  if (status === 'ok') return 'text-green-300 bg-green-900/30';
  if (status === 'decrypt_failed') return 'text-yellow-300 bg-yellow-900/30';
  return 'text-red-300 bg-red-900/30';
}

export function MessagesView() {
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const messages = useMessages();

  const filtered = useMemo(() => {
    if (channel === 'all') return messages;
    return messages.filter((m) => m.channelId === channel);
  }, [messages, channel]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl">Messaging</h2>
        <div className="text-xs text-gray-400">{filtered.length} shown / {messages.length} total</div>
      </div>

      <div className="flex gap-2 mb-4 text-xs">
        <button onClick={() => setChannel('all')} className={`px-3 py-1 rounded ${channel === 'all' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>All</button>
        <button onClick={() => setChannel('blackboxmesh')} className={`px-3 py-1 rounded ${channel === 'blackboxmesh' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>BlackBoxMesh</button>
        <button onClick={() => setChannel('meshtastic-longfast')} className={`px-3 py-1 rounded ${channel === 'meshtastic-longfast' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Meshtastic LongFast</button>
      </div>

      <div className="flex-1 bg-gray-700 rounded overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">No messages yet.</div>
        ) : (
          <div className="p-3 space-y-2">
            {filtered.slice().reverse().map((m) => (
              <div key={m.id} className={`rounded p-2 border ${m.direction === 'out' ? 'border-blue-800 bg-blue-950/30 ml-8' : 'border-gray-600 bg-gray-800/70 mr-8'}`}>
                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                  <div className="flex items-center gap-2">
                    <span>{m.direction === 'out' ? 'out' : 'in'}</span>
                    <span>{m.transport}</span>
                    <span className={`px-1.5 py-0.5 rounded ${statusClass(m.status)}`}>{m.status}</span>
                  </div>
                  <span>{new Date(m.timestampMs).toLocaleTimeString()}</span>
                </div>
                <div className="text-xs mb-1">
                  {m.from && <span className="text-blue-300">{m.from}</span>}
                  {m.from && m.to && <span className="text-gray-500 mx-1">→</span>}
                  {m.to && <span className="text-gray-300">{m.to}</span>}
                </div>
                {m.text && <div className="text-sm break-words">{m.text}</div>}
                {!m.text && m.payloadHex && <div className="text-xs font-mono break-all text-gray-300">{m.payloadHex}</div>}
                <div className="text-[11px] text-gray-500 mt-1">
                  {m.rssi != null ? `${m.rssi} dBm` : '—'} / {m.snr != null ? `${m.snr} dB` : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
