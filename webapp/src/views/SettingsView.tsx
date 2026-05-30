import { useEffect, useState } from 'react';
import type { BridgeHealth, BrowserGpsControl, MeshControl, PhoneGpsControl, RadioControl } from '../layout/sidebarTypes';
import { useAppSettings } from '../hooks/useAppSettings';

export function SettingsView({
  radio,
  mesh,
  browserGps,
  phoneGps,
  bridgeHealth,
}: {
  radio: RadioControl;
  mesh: MeshControl;
  browserGps: BrowserGpsControl;
  phoneGps: PhoneGpsControl;
  bridgeHealth: BridgeHealth;
}) {
  const [settings, persistSettings] = useAppSettings();
  const [draft, setDraft] = useState(settings);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const saveSettings = () => {
    persistSettings(draft);
    setSavedAt(Date.now());
  };

  return (
    <>
      <h2 className="text-xl mb-4">Config</h2>
      <div className="space-y-4">
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-3">Connections</h3>
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Radio ({radio.activeTransport === 'ble' ? 'BLE' : 'USB'})</span>
              <div className="flex items-center gap-1">
                <button onClick={radio.onConnectUsb} disabled={!radio.usbSupported} className="px-2 py-1 rounded bg-green-700 hover:bg-green-600 disabled:bg-gray-600 disabled:text-gray-400">USB</button>
                <button onClick={radio.onConnectBle} disabled={!radio.bleSupported} className="px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-600 disabled:text-gray-400">BLE</button>
                <button onClick={radio.onDisconnect} className="px-2 py-1 rounded bg-red-700 hover:bg-red-600">Disconnect</button>
              </div>
            </div>
            <div className="text-xs text-gray-300">Status: <span className={radio.status === 'connected' ? 'text-green-300' : radio.status === 'failed' ? 'text-red-300' : 'text-yellow-300'}>{radio.status}</span>{radio.nodeId ? <span className="ml-2 text-blue-300">{radio.nodeId}</span> : null}</div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span>Mesh</span>
              <button onClick={mesh.onToggle} className={`px-2 py-1 rounded ${mesh.status === 'connected' ? 'bg-red-700 hover:bg-red-600' : 'bg-green-700 hover:bg-green-600'}`}>
                {mesh.status === 'connected' ? 'Disconnect' : 'Connect'}
              </button>
            </div>
            <div className="text-xs text-gray-300">Status: <span className={mesh.status === 'connected' ? 'text-green-300' : 'text-yellow-300'}>{mesh.status}</span> <span className="ml-2 text-blue-300">{mesh.nodeCount} peers</span></div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span>Browser GPS</span>
              <button onClick={browserGps.onToggle} className={`px-2 py-1 rounded ${browserGps.enabled ? 'bg-red-700 hover:bg-red-600' : 'bg-green-700 hover:bg-green-600'}`}>
                {browserGps.enabled ? 'Stop' : 'Use'}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span>Phone GPS</span>
              <button onClick={phoneGps.onToggle} className={`px-2 py-1 rounded ${phoneGps.enabled ? 'bg-red-700 hover:bg-red-600' : 'bg-green-700 hover:bg-green-600'}`}>
                {phoneGps.enabled ? 'Stop' : 'Use'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-3">Radio</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Frequency (MHz)</label>
              <input type="number" value={draft.radioFrequencyMhz} onChange={(e) => setDraft((s) => ({ ...s, radioFrequencyMhz: Number(e.target.value) || 0 }))} className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">TX Power (dBm)</label>
              <input type="number" value={draft.radioTxPowerDbm} max="30" onChange={(e) => setDraft((s) => ({ ...s, radioTxPowerDbm: Number(e.target.value) || 0 }))} className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2" />
            </div>
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-3">Map</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Google Maps API Key</label>
              <input type="password" value={draft.googleMapsApiKey} onChange={(e) => setDraft((s) => ({ ...s, googleMapsApiKey: e.target.value }))} placeholder="Enter your Google Maps API key" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2" />
            </div>
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-3">Advanced</h3>
          <div className="space-y-3 mb-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">GPS Bridge Base URL</label>
              <input type="text" value={draft.gpsBridgeBaseUrl} onChange={(e) => setDraft((s) => ({ ...s, gpsBridgeBaseUrl: e.target.value.trim() }))} className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">MQTT Bridge Base URL</label>
              <input type="text" value={draft.mqttBridgeBaseUrl} onChange={(e) => setDraft((s) => ({ ...s, mqttBridgeBaseUrl: e.target.value.trim() }))} className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2" />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>GPS Bridge service</span><span className={bridgeHealth.gpsBridgeServerRunning ? 'text-green-300' : 'text-yellow-300'}>{bridgeHealth.gpsBridgeServerRunning ? 'Up' : 'Down'}</span></div>
            <div className="flex justify-between"><span>MQTT Bridge service</span><span className={bridgeHealth.mqttBridgeRunning ? 'text-green-300' : 'text-yellow-300'}>{bridgeHealth.mqttBridgeRunning ? 'Up' : 'Down'}</span></div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={saveSettings} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500">Save Settings</button>
            {savedAt && <span className="text-xs text-green-300">Saved {new Date(savedAt).toLocaleTimeString()}</span>}
          </div>
        </div>
      </div>
    </>
  );
}
