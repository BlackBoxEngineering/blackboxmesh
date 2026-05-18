import { useEffect, useState } from 'react';
import { radioNodeAdapter } from '../services/radioNodeAdapter';
import { serialClient, type SerialStatus } from '../services/serialClient';

export function useRadioConnection() {
  const [radioStatus, setRadioStatus] = useState<SerialStatus>(() => serialClient.getStatus());
  const [radioNodeId, setRadioNodeId] = useState<string | null>(null);
  const [radioSupported] = useState(() => serialClient.isSupported());

  useEffect(() => {
    const offStatus = serialClient.onStatus(setRadioStatus);
    const offEvent = serialClient.onEvent((event) => {
      if (event.kind === 'ready') setRadioNodeId(serialClient.getNodeId());
    });
    void serialClient.tryAutoReconnect().then((ok) => {
      if (ok) {
        radioNodeAdapter.start();
        setRadioNodeId(serialClient.getNodeId());
      }
    });
    return () => {
      offStatus();
      offEvent();
    };
  }, []);

  const handleRadioToggle = async () => {
    if (serialClient.getStatus() === 'connected' || serialClient.getStatus() === 'connecting') {
      radioNodeAdapter.stop();
      await serialClient.disconnect();
      setRadioNodeId(null);
      return;
    }
    try {
      await serialClient.connect();
      radioNodeAdapter.start();
      setRadioNodeId(serialClient.getNodeId());
    } catch (error) {
      console.warn('[radio] connect failed', error);
    }
  };

  return { radioStatus, radioNodeId, radioSupported, handleRadioToggle };
}
