import { useEffect } from 'react';
import { gpsService } from '../services/gpsService';
import { serialClient, type SerialStatus } from '../services/serialClient';

export function useRadioGpsFeed(radioStatus: SerialStatus, browserGeoEnabled: boolean) {
  useEffect(() => {
    if (radioStatus !== 'connected') return;
    let lastSent = 0;
    const sendFix = (lat: number, lon: number, acc: number) => {
      const now = Date.now();
      if (now - lastSent < 5000) return;
      lastSent = now;
      serialClient
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
