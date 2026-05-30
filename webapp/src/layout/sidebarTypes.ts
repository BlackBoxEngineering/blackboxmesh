import type { MeshStatus } from '../services/meshClient';
import type { TransportKind, TransportStatus } from '../services/transport/types';

export interface BridgeHealth {
  gpsBridgeServerRunning: boolean;
  mqttBridgeRunning: boolean;
}

export interface RadioControl {
  status: TransportStatus;
  nodeId: string | null;
  usbSupported: boolean;
  bleSupported: boolean;
  activeTransport: TransportKind;
  onConnectUsb: () => void;
  onConnectBle: () => void;
  onDisconnect: () => void;
}

export interface MeshControl {
  status: MeshStatus;
  nodeCount: number;
  supported: true;
  onToggle: () => void;
}

export interface BrowserGpsControl {
  enabled: boolean;
  onToggle: () => void;
}

export interface PhoneGpsControl {
  enabled: boolean;
  onToggle: () => void;
}
