import { meshClient } from './meshClient';
import { radioTransportManager } from './transport/radioTransportManager';

let unsubscribe: (() => void) | null = null;

export const radioNodeAdapter = {
  start(): void {
    if (unsubscribe) return;
    unsubscribe = radioTransportManager.onEvent((event) => {
      if (event.kind === 'rx') {
        const rx = event.data as { from: string; to: string; type: number; hops: number; rssi: number; snr: number; payload: string };
        meshClient.ingestRadioRx({ from: rx.from, type: rx.type, rssi: rx.rssi, snr: rx.snr, payload: rx.payload });
      } else if (event.kind === 'status') {
        const s = event.data as { nodeId?: string; latitude?: number; longitude?: number; rssi?: number; snr?: number; routes?: number };
        if (!s?.nodeId) return;
        meshClient.upsertNode({
          id: s.nodeId,
          latitude: typeof s.latitude === 'number' ? s.latitude : undefined,
          longitude: typeof s.longitude === 'number' ? s.longitude : undefined,
          rssi: typeof s.rssi === 'number' ? s.rssi : undefined,
          snr: typeof s.snr === 'number' ? s.snr : undefined,
        });
      }
    });
  },

  stop(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  },
};
