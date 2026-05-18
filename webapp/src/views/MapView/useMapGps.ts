import { useEffect, useRef, useState } from 'react';
import { gpsService } from '../../services/gpsService';
import type { GpsPoint } from '../../types/gps';

export function useMapGps(browserGeoEnabled: boolean) {
  const [gpsPosition, setGpsPosition] = useState<GpsPoint | null>(null);
  const [browserGPS, setBrowserGPS] = useState<GpsPoint | null>(null);
  const [deviceGPS, setDeviceGPS] = useState<GpsPoint | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const unsubscribe = gpsService.subscribe((position) => {
      if (position && (!hasInitialized.current || !gpsPosition
        || Math.abs(position.latitude - gpsPosition.latitude) > 0.0001
        || Math.abs(position.longitude - gpsPosition.longitude) > 0.0001)) {
        setGpsPosition({ latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy });
        hasInitialized.current = true;
      }
    });

    return () => unsubscribe();
  }, [gpsPosition]);

  useEffect(() => {
    if (!browserGeoEnabled) {
      setBrowserGPS(null);
      return;
    }
    if (!navigator.geolocation) return;

    console.log('Requesting Computer GPS location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        console.log('Computer GPS (initial):', pos);
        setBrowserGPS(pos);
      },
      (error) => {
        console.log('Computer GPS failed:', error.message, 'code:', error.code);
      },
      { enableHighAccuracy: false, timeout: 60000, maximumAge: 300000 },
    );

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const pos = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        console.log('Computer GPS (update):', pos);
        setBrowserGPS(pos);
      },
      (error) => {
        console.log('Computer GPS watch error:', error.message);
      },
      { enableHighAccuracy: false, timeout: 60000, maximumAge: 300000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [browserGeoEnabled]);

  useEffect(() => {
    if (gpsPosition) {
      console.log('Device GPS:', gpsPosition);
      setDeviceGPS(gpsPosition);
    }
  }, [gpsPosition]);

  return { gpsPosition, browserGPS, deviceGPS };
}
