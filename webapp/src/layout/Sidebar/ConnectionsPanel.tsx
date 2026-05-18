import type { BridgeHealth, BrowserGpsControl, MeshControl, PhoneGpsControl, RadioControl } from '../sidebarTypes';

export function ConnectionsPanel({
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
  return (
    <div className="bg-gray-700 p-3 rounded">
      <div className="text-sm font-medium mb-2">Connections</div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={radio.status === 'connected' ? 'text-green-400' : radio.status === 'connecting' ? 'text-yellow-400' : 'text-gray-500'}>&bull;</span>
            <span className="truncate">
              Radio
              {radio.nodeId && <span className="text-blue-400 ml-1">{radio.nodeId}</span>}
            </span>
          </div>
          <button
            onClick={radio.onToggle}
            disabled={!radio.supported || radio.status === 'connecting'}
            title={radio.supported ? '' : 'Web Serial not supported in this browser (use Chrome / Edge)'}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              !radio.supported
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : radio.status === 'connected'
                  ? 'bg-red-700 hover:bg-red-600'
                  : radio.status === 'connecting'
                    ? 'bg-yellow-700'
                    : 'bg-green-700 hover:bg-green-600'
            }`}
          >
            {radio.status === 'connected' ? 'Disconnect' : radio.status === 'connecting' ? '...' : 'Connect'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={mesh.status === 'connected' ? 'text-green-400' : mesh.status === 'connecting' ? 'text-yellow-400' : 'text-gray-500'}>&bull;</span>
            <span className="truncate">
              Mesh
              {mesh.status === 'connected' && mesh.nodeCount > 0 && (
                <span className="text-blue-400 ml-1">{mesh.nodeCount} peers</span>
              )}
            </span>
          </div>
          <button
            onClick={mesh.onToggle}
            disabled={!bridgeHealth.mqttBridgeRunning || mesh.status === 'connecting'}
            title={bridgeHealth.mqttBridgeRunning ? '' : 'Local mqtt-bridge not reachable on :8081'}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              !bridgeHealth.mqttBridgeRunning
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : mesh.status === 'connected'
                  ? 'bg-red-700 hover:bg-red-600'
                  : mesh.status === 'connecting'
                    ? 'bg-yellow-700'
                    : 'bg-green-700 hover:bg-green-600'
            }`}
          >
            {mesh.status === 'connected' ? 'Disconnect' : mesh.status === 'connecting' ? '...' : 'Connect'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={browserGps.enabled ? 'text-green-400' : 'text-gray-500'}>&bull;</span>
            <span className="truncate">Browser GPS</span>
          </div>
          <button
            onClick={browserGps.onToggle}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              browserGps.enabled ? 'bg-red-700 hover:bg-red-600' : 'bg-green-700 hover:bg-green-600'
            }`}
          >
            {browserGps.enabled ? 'Stop' : 'Use'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={phoneGps.enabled ? 'text-green-400' : 'text-gray-500'}>&bull;</span>
            <span className="truncate">Phone GPS</span>
          </div>
          <button
            onClick={phoneGps.onToggle}
            disabled={!bridgeHealth.gpsBridgeServerRunning}
            title={bridgeHealth.gpsBridgeServerRunning ? '' : 'Local gps-bridge not reachable on :8080'}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              !bridgeHealth.gpsBridgeServerRunning
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : phoneGps.enabled
                  ? 'bg-red-700 hover:bg-red-600'
                  : 'bg-green-700 hover:bg-green-600'
            }`}
          >
            {phoneGps.enabled ? 'Stop' : 'Use'}
          </button>
        </div>
      </div>
    </div>
  );
}
