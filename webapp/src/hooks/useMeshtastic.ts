import { useEffect, useState, useCallback } from 'react';
import { getMeshtasticNodes, getMeshtasticMessages, connectWebSocket } from '../services/mqttBridge';
import type { MeshtasticNode, MeshtasticMessage } from '../services/types';

export function useMeshtastic() {
  const [nodes, setNodes] = useState<MeshtasticNode[]>([]);
  const [messages, setMessages] = useState<MeshtasticMessage[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([getMeshtasticNodes(), getMeshtasticMessages()]);
      if (Array.isArray(n)) setNodes(n);
      if (Array.isArray(m)) setMessages(m);
    } catch { /* bridge offline */ }
  }, []);

  useEffect(() => {
    fetchAll();
    const poll = setInterval(fetchAll, 15000);

    const ws = connectWebSocket((msg) => {
      if (msg.type === 'meshtastic_node' && msg.data) {
        setNodes(prev => {
          const idx = prev.findIndex(n => n.id === msg.data.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = msg.data;
            return updated;
          }
          return [...prev, msg.data];
        });
      }
      if (msg.type === 'meshtastic_message' && msg.data) {
        setMessages(prev => [...prev, msg.data]);
      }
    });

    return () => {
      clearInterval(poll);
      ws.close();
    };
  }, [fetchAll]);

  return { nodes, messages };
}
