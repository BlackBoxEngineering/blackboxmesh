import { useMeshtastic } from '../../hooks/useMeshtastic';

export function MeshtasticMessages() {
  const { messages, nodes } = useMeshtastic();

  const getNodeName = (id: string) => {
    const node = nodes.find(n => n.id === id);
    return node?.longName || node?.shortName || id;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <span>📻</span> Meshtastic Messages
        <span className="text-xs bg-green-600 px-2 py-0.5 rounded-full">{messages.length}</span>
      </h3>
      {messages.length === 0 ? (
        <p className="text-sm text-gray-400">
          No text messages decoded yet. Listening on default LongFast channel...
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {[...messages].reverse().map((msg) => (
            <div key={msg.id} className="bg-gray-700 rounded-lg p-3 text-sm">
              <div className="flex justify-between items-start">
                <span className="font-medium text-green-400">{getNodeName(msg.from)}</span>
                <span className="text-xs text-gray-400">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="mt-1 text-gray-200">{msg.text}</p>
              <div className="mt-1 text-xs text-gray-500 flex gap-3">
                <span>→ {msg.to === 'broadcast' ? 'all' : getNodeName(msg.to)}</span>
                {msg.rssi && <span>{msg.rssi} dBm</span>}
                {msg.snr && <span>SNR {msg.snr}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
