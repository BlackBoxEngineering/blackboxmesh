import { useEffect } from 'react';
import { gpsService } from '../services/gpsService';

export function useGpsBridge(gpsBridgeRunning: boolean) {
  useEffect(() => {
    localStorage.setItem('gpsBridgeRunning', gpsBridgeRunning.toString());
    if (gpsBridgeRunning) {
      gpsService.start();
    } else {
      gpsService.stop();
    }
  }, [gpsBridgeRunning]);

  useEffect(() => {
    if (gpsBridgeRunning) {
      gpsService.start();
    }
  }, []);
}
