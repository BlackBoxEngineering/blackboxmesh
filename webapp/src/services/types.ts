export interface BlackBoxMeshNode {
  id: string;
  latitude?: number;
  longitude?: number;
  rssi?: number;
  snr?: number;
  lastSeen: number;
  routes: string[];
}

export interface BlackBoxMeshMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  encrypted: boolean;
}

export interface MeshtasticNode {
  id: string;
  longName?: string;
  shortName?: string;
  hwModel?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  rssi?: number;
  snr?: number;
  lastSeen: number;
}

export interface MeshtasticMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  rssi?: number;
  snr?: number;
}

export interface EncryptionResult {
  status: 'encrypted' | 'decrypted' | 'error';
  message: string;
}
