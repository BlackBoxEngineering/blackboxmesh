import { useEffect, useState } from 'react';

const GPS_BRIDGE_URL =
  (import.meta.env.VITE_GPS_BRIDGE_URL as string | undefined) ||
  'http://localhost:8080';

const MQTT_BRIDGE_URL =
  (import.meta.env.VITE_MQTT_BRIDGE_URL as string | undefined) ||
  'http://localhost:8081';

export function useBridgeHealth() {
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [gpsBridgeServerRunning, setGpsBridgeServerRunning] = useState(false);
  const [mqttBridgeRunning, setMqttBridgeRunning] = useState(false);

  useEffect(() => {
    const checkGpsBridge = async () => {
      try {
        const response = await fetch(`${GPS_BRIDGE_URL}/status`, {
          signal: AbortSignal.timeout(1000),
        }).catch(() => null);

        if (response?.ok) {
          setGpsBridgeServerRunning(true);
          const gpsResponse = await fetch(`${GPS_BRIDGE_URL}/gps`, {
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
      try {
        const response = await fetch(`${MQTT_BRIDGE_URL}/status`, {
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
