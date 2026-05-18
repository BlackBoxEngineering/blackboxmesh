import type { BridgeHealth } from '../sidebarTypes';

export function LocalHubPanel({ bridgeHealth }: { bridgeHealth: BridgeHealth }) {
  return (
    <div className="bg-gray-700 p-3 rounded">
      <div className="text-sm font-medium mb-2">Local Hub</div>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">mqtt-bridge :8081</span>
          <span className={bridgeHealth.mqttBridgeRunning ? 'text-green-400' : 'text-red-400'}>
            {bridgeHealth.mqttBridgeRunning ? 'up' : 'down'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-300">gps-bridge :8080</span>
          <span className={bridgeHealth.gpsBridgeServerRunning ? 'text-green-400' : 'text-red-400'}>
            {bridgeHealth.gpsBridgeServerRunning ? 'up' : 'down'}
          </span>
        </div>
        {!bridgeHealth.mqttBridgeRunning && (
          <div className="text-[10px] text-yellow-400 mt-2">
            Hub not running. Start with <code>npm run dev</code>.
          </div>
        )}
      </div>
    </div>
  );
}
