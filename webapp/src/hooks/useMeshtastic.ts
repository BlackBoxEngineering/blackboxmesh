import { useEffect, useState, useCallback } from 'react';
import { getMeshtasticNodes, getMeshtasticMessages, connectWebSocket } from '../services/mqttBridge';
import { meshtasticStore } from '../services/meshtasticStore';
import type { MeshtasticNode, MeshtasticMessage } from '../services/types';

export function useMeshtastic() {
  const [nodes, setNodes] = useState<MeshtasticNode[]>(meshtasticStore.nodes);
  const [messages, setMessages] = useState<MeshtasticMessage[]>(meshtasticStore.messages);

  // Always subscribe to the local store (Web Serial direct path)
  useEffect(() => {
    const offNodes = meshtasticStore.onNodes(setNodes);
    const offMsgs = meshtasticStore.onMessages(setMessages);
    return () => { offNodes(); offMsgs(); };
  }, []);

  // Also try the bridge path (merges in if available)
  const fetchBridge = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([getMeshtasticNodes(), getMeshtasticMessages()]);
      if (Array.isArray(n) && n.length > 0) {
        setNodes(prev => {
          const map = new Map(prev.map(x => [x.id, x]));
          for (const node of n) map.set(node.id, node);
          return Array.from(map.values());
        });
      }
      if (Array.isArray(m) && m.length > 0) {
        setMessages(prev => {
          const ids = new Set(prev.map(x => x.id));
          const newMsgs = m.filter(x => !ids.has(x.id));
          return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
        });
      }
    } catch { /* bridge offline — local store is fine */ }
  }, []);

  useEffect(() => {
    fetchBridge();
    const poll = setInterval(fetchBridge, 15000);

    let ws: WebSocket | null = null;
    try {
      ws = connectWebSocket((msg) => {
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
    } catch { /* bridge not available */ }

    return () => {
      clearInterval(poll);
      ws?.close();
    };
  }, [fetchBridge]);

  return { nodes, messages };
}
