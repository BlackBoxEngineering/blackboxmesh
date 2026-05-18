import { serialClient } from './serialClient';
import { meshClient } from './meshClient';

/**
 * Subscribes once (at app bootstrap) to serialClient RX events and forwards
 * them into the mesh node store. Lives outside React so it is not affected
 * by component remounts under StrictMode.
 *
 * Idempotent — calling start() twice will only register one subscription.
 */
let stop: (() => void) | null = null;

export function startRadioMeshBridge(): void {
  if (stop) return;
  stop = serialClient.onEvent((event) => {
    if (event.kind !== 'rx' || !event.data) return;
    const d = event.data as {
      from: string;
      to: string;
      type: number;
      hops: number;
      rssi: number;
      snr: number;
      payload: string;
    };
    meshClient.ingestRadioRx({
      from: d.from,
      type: d.type,
      rssi: d.rssi,
      snr: d.snr,
      payload: d.payload,
    });
  });
}

export function stopRadioMeshBridge(): void {
  if (stop) {
    stop();
    stop = null;
  }
}
