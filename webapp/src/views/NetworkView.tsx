import type { BridgeHealth, BrowserGpsControl, PhoneGpsControl } from '../layout/sidebarTypes';
import { MeshtasticMessages } from '../components/Messages/MeshtasticMessages';

export function NetworkView({
  bridgeHealth,
  browserGps,
  phoneGps,
  floodAnnouncerRunning,
  onFloodAnnouncerToggle,
}: {
  bridgeHealth: BridgeHealth & { phoneConnected: boolean };
  browserGps: BrowserGpsControl;
  phoneGps: PhoneGpsControl;
  floodAnnouncerRunning: boolean;
  onFloodAnnouncerToggle: () => void;
}) {
  return (
    <>
      <h2 className="text-xl mb-4">Network Services</h2>
      <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
        <div className="bg-gray-700 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-medium">GPS Bridge Server</h3>
              <p className="text-sm text-gray-400">GPS data from phone via ADB</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={bridgeHealth.gpsBridgeServerRunning ? 'text-green-400 text-sm' : 'text-gray-400 text-sm'}>
                {bridgeHealth.gpsBridgeServerRunning ? 'Running' : 'Not Running'}
              </span>
              <button
                onClick={phoneGps.onToggle}
                className={`px-4 py-2 rounded transition-colors ${
                  phoneGps.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {phoneGps.enabled ? 'Stop GPS Client' : 'Start GPS Client'}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-400">Server: http://localhost:8080/gps</div>
            {!bridgeHealth.gpsBridgeServerRunning && (
              <div className="text-xs text-yellow-400">Run: npm run dev (starts automatically)</div>
            )}
            {bridgeHealth.gpsBridgeServerRunning && !bridgeHealth.phoneConnected && (
              <div className="text-xs text-yellow-400">Server running but no GPS data - Check phone connection</div>
            )}
            {bridgeHealth.gpsBridgeServerRunning && bridgeHealth.phoneConnected && (
              <div className="text-xs text-green-400">GPS data available</div>
            )}
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-medium">Browser Location</h3>
              <p className="text-sm text-gray-400">Share this device's location via the browser</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={browserGps.enabled ? 'text-green-400 text-sm' : 'text-gray-400 text-sm'}>
                {browserGps.enabled ? 'Sharing' : 'Off'}
              </span>
              <button
                onClick={browserGps.onToggle}
                className={`px-4 py-2 rounded transition-colors ${
                  browserGps.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {browserGps.enabled ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-400">
              Uses <code>navigator.geolocation</code> - browser will prompt for permission on connect.
            </div>
            {browserGps.enabled && (
              <div className="text-xs text-yellow-400">
                Accuracy depends on the device (mobile GPS &gt; desktop IP geolocation).
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-medium">MQTT Bridge Server</h3>
              <p className="text-sm text-gray-400">Node reporting & messaging service</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={bridgeHealth.mqttBridgeRunning ? 'text-green-400 text-sm' : 'text-gray-400 text-sm'}>
                {bridgeHealth.mqttBridgeRunning ? 'Running' : 'Not Running'}
              </span>
              <button
                onClick={() => window.open('http://localhost:8081', '_blank')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Open Dashboard
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-400">Server: http://localhost:8081/report</div>
            {!bridgeHealth.mqttBridgeRunning && (
              <div className="text-xs text-yellow-400">Run: node services/mqtt-bridge.js</div>
            )}
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-medium">Flood Announcer</h3>
              <p className="text-sm text-gray-400">Automatic beacon broadcasts</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={floodAnnouncerRunning ? 'text-green-400 text-sm' : 'text-gray-400 text-sm'}>
                {floodAnnouncerRunning ? 'Active' : 'Not Running'}
              </span>
              <button
                onClick={onFloodAnnouncerToggle}
                className={`px-4 py-2 rounded transition-colors ${
                  floodAnnouncerRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {floodAnnouncerRunning ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-400">Beacon interval: 2 minutes</div>
            {!floodAnnouncerRunning && (
              <div className="text-xs text-yellow-400">Controlled by firmware beacon settings</div>
            )}
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-3">Quick Start</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-blue-400">1.</span>
              <div>
                <div className="font-medium">Start GPS Bridge on Phone</div>
                <div className="text-xs text-gray-400">Run GPS bridge: npm run dev (starts automatically)</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400">2.</span>
              <div>
                <div className="font-medium">Enable GPS Client</div>
                <div className="text-xs text-gray-400">Click "Enable" above to connect to GPS bridge</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400">3.</span>
              <div>
                <div className="font-medium">View on Map</div>
                <div className="text-xs text-gray-400">Go to Map view to see your location</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <MeshtasticMessages />
        </div>
      </div>
    </>
  );
}
