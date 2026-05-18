import { BlackBoxMeshNode, MeshtasticNode, MeshtasticMessage } from './types';

// MQTT bridge base URL. Configurable via Vite env var so the same build can
// target localhost in dev or a real LAN/IoT-Core relay later.
// Set VITE_MQTT_BRIDGE_URL in .env.local, e.g. http://localhost:8081
const MQTT_BRIDGE_URL =
  (import.meta.env.VITE_MQTT_BRIDGE_URL as string | undefined) ||
  'http://localhost:8081';

const WS_URL = MQTT_BRIDGE_URL.replace(/^http/, 'ws') + '/ws';

export const sendMessage = async (message: string): Promise<void> => {
  await fetch(`${MQTT_BRIDGE_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
};

export const getNodes = async (): Promise<BlackBoxMeshNode[]> => {
  const response = await fetch(`${MQTT_BRIDGE_URL}/nodes`);
  return response.json();
};

export const getMeshtasticNodes = async (): Promise<MeshtasticNode[]> => {
  const response = await fetch(`${MQTT_BRIDGE_URL}/meshtastic/nodes`);
  return response.json();
};

export const getMeshtasticMessages = async (): Promise<MeshtasticMessage[]> => {
  const response = await fetch(`${MQTT_BRIDGE_URL}/meshtastic/messages`);
  return response.json();
};

export const connectWebSocket = (onMessage: (data: any) => void): WebSocket => {
  const ws = new WebSocket(WS_URL);
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  return ws;
};