import { BlackBoxMeshNode, MeshtasticNode, MeshtasticMessage } from './types';
import { appSettings } from './appSettings';

function mqttBaseUrl(): string {
  return appSettings.get().mqttBridgeBaseUrl;
}

export const sendMessage = async (message: string): Promise<void> => {
  await fetch(`${mqttBaseUrl()}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
};

export const getNodes = async (): Promise<BlackBoxMeshNode[]> => {
  const response = await fetch(`${mqttBaseUrl()}/nodes`);
  return response.json();
};

export const getMeshtasticNodes = async (): Promise<MeshtasticNode[]> => {
  const response = await fetch(`${mqttBaseUrl()}/meshtastic/nodes`);
  return response.json();
};

export const getMeshtasticMessages = async (): Promise<MeshtasticMessage[]> => {
  const response = await fetch(`${mqttBaseUrl()}/meshtastic/messages`);
  return response.json();
};

export const connectWebSocket = (onMessage: (data: any) => void): WebSocket => {
  const ws = new WebSocket(mqttBaseUrl().replace(/^http/, 'ws') + '/ws');
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  return ws;
};
