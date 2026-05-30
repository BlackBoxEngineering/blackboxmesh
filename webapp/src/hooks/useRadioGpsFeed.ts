import { useEffect } from 'react';
import { gpsService } from '../services/gpsService';
import { radioTransportManager } from '../services/transport/radioTransportManager';
import type { TransportStatus } from '../services/transport/types';

export function useRadioGpsFeed(radioStatus: TransportStatus, browserGeoEnabled: boolean) {
  useEffect(() => {
    if (radioStatus !== 'connected') return;
    let lastSent = 0;
    let lastLat = 0;
    let lastLon = 0;
    const MIN_INTERVAL = 60000; // 60 seconds minimum between sends
    const MIN_MOVE = 0.00005;   // ~5 metres before resending

    const sendFix = (lat: number, lon: number, acc: number) => {
      const now = Date.now();
      const moved = Math.abs(lat - lastLat) > MIN_MOVE || Math.abs(lon - lastLon) > MIN_MOVE;
      if (!moved && now - lastSent < MIN_INTERVAL) return;
      lastSent = now;
      lastLat = lat;
      lastLon = lon;
      radioTransportManager
        .sendLine(`BN GPS ${lat.toFixed(6)} ${lon.toFixed(6)} ${acc.toFixed(1)}`)
        .catch((error) => console.warn('[radio] sendLine failed', error));
    };

    const offGps = gpsService.subscribe((position) => {
      if (position) sendFix(position.latitude, position.longitude, position.accuracy ?? 10);
    });

    let watchId: number | null = null;
    if (browserGeoEnabled && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => sendFix(position.coords.latitude, position.coords.longitude, position.coords.accuracy ?? 20),
        (error) => console.warn('[radio] geo watch err', error.message),
        { enableHighAccuracy: false, timeout: 60000, maximumAge: 30000 },
      );
    }

    return () => {
      offGps();
      if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    };
  }, [radioStatus, browserGeoEnabled]);
}
