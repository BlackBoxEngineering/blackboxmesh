import { useEffect, useState } from 'react';
import { appSettings } from '../services/appSettings';

export function useBridgeHealth() {
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [gpsBridgeServerRunning, setGpsBridgeServerRunning] = useState(false);
  const [mqttBridgeRunning, setMqttBridgeRunning] = useState(false);

  useEffect(() => {
    const checkGpsBridge = async () => {
      const { gpsBridgeBaseUrl } = appSettings.get();
      try {
        const response = await fetch(`${gpsBridgeBaseUrl}/status`, {
          signal: AbortSignal.timeout(1000),
        }).catch(() => null);

        if (response?.ok) {
          setGpsBridgeServerRunning(true);
          const gpsResponse = await fetch(`${gpsBridgeBaseUrl}/gps`, {
            signal: AbortSignal.timeout(1000),
          }).catch(() => null);
          setPhoneConnected(gpsResponse?.ok || false);
        } else {
          setGpsBridgeServerRunning(false);
          setPhoneConnected(false);
        }
      } catch {
        setGpsBridgeServerRunning(false);
        setPhoneConnected(false);
      }
    };
    checkGpsBridge();
    const interval = setInterval(checkGpsBridge, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkMqtt = async () => {
      const { mqttBridgeBaseUrl } = appSettings.get();
      try {
        const response = await fetch(`${mqttBridgeBaseUrl}/status`, {
          signal: AbortSignal.timeout(1000),
        });
        setMqttBridgeRunning(response.ok);
      } catch {
        setMqttBridgeRunning(false);
      }
    };
    checkMqtt();
    const interval = setInterval(checkMqtt, 5000);
    return () => clearInterval(interval);
  }, []);

  return { phoneConnected, gpsBridgeServerRunning, mqttBridgeRunning };
}
