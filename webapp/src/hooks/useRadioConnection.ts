import { useEffect, useState } from 'react';
import { radioNodeAdapter } from '../services/radioNodeAdapter';
import { radioTransportManager } from '../services/transport/radioTransportManager';
import type { TransportKind, TransportStatus } from '../services/transport/types';

export function useRadioConnection() {
  const [radioStatus, setRadioStatus] = useState<TransportStatus>(() => radioTransportManager.getStatus());
  const [radioNodeId, setRadioNodeId] = useState<string | null>(null);
  const [activeTransport, setActiveTransport] = useState<TransportKind>(() => radioTransportManager.getActiveTransport());
  const [radioUsbSupported] = useState(() => radioTransportManager.isSupported('usb_serial'));
  const [radioBleSupported] = useState(() => radioTransportManager.isSupported('ble'));

  useEffect(() => {
    const offStatus = radioTransportManager.onStatus((status) => {
      setRadioStatus(status);
      setRadioNodeId(radioTransportManager.getNodeId());
      setActiveTransport(radioTransportManager.getActiveTransport());
    });
    const offEvent = radioTransportManager.onEvent((event) => {
      if (event.kind === 'ready') setRadioNodeId(radioTransportManager.getNodeId());
    });
    void radioTransportManager.tryAutoReconnectUsb().then((ok) => {
      if (ok) {
        radioNodeAdapter.start();
        setRadioNodeId(radioTransportManager.getNodeId());
        setActiveTransport(radioTransportManager.getActiveTransport());
      }
    });
    return () => {
      offStatus();
      offEvent();
    };
  }, []);

  const disconnectRadio = async () => {
    if (radioStatus === 'connected' || radioStatus === 'connecting' || radioStatus === 'reconnecting') {
      radioNodeAdapter.stop();
      await radioTransportManager.disconnect();
      setRadioNodeId(null);
    }
  };

  const connectRadio = async (kind: TransportKind) => {
    try {
      await radioTransportManager.connect(kind);
      radioNodeAdapter.start();
      setRadioNodeId(radioTransportManager.getNodeId());
      setActiveTransport(kind);
    } catch (error) {
      console.warn('[radio] connect failed', error);
    }
  };

  return {
    radioStatus,
    radioNodeId,
    activeTransport,
    radioUsbSupported,
    radioBleSupported,
    connectUsb: () => connectRadio('usb_serial'),
    connectBle: () => connectRadio('ble'),
    disconnectRadio,
  };
}
