import type { SerialStatus } from '../services/serialClient';
import type { MeshStatus } from '../services/meshClient';

export interface BridgeHealth {
  gpsBridgeServerRunning: boolean;
  mqttBridgeRunning: boolean;
}

export interface RadioControl {
  status: SerialStatus;
  nodeId: string | null;
  supported: boolean;
  onToggle: () => void;
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
