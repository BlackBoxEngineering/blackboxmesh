export function ConfigSidebarPanel() {
  return (
    <div className="p-4 border-b border-gray-700">
      <div className="space-y-3">
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-sm font-medium mb-2">Device Settings</div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Beacon Interval:</span>
              <span className="text-blue-400">2 min</span>
            </div>
            <div className="flex justify-between">
              <span>TX Power:</span>
              <span className="text-blue-400">14 dBm</span>
            </div>
            <div className="flex justify-between">
              <span>Spreading Factor:</span>
              <span className="text-blue-400">SF7</span>
            </div>
          </div>
        </div>
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-sm font-medium mb-2">Bridge Settings</div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span>GPS Bridge:</span>
              <span className="text-green-400">Active</span>
            </div>
            <div className="flex justify-between">
              <span>MQTT Bridge:</span>
              <span className="text-green-400">Active</span>
            </div>
            <div className="flex justify-between">
              <span>Update Rate:</span>
              <span className="text-blue-400">10s</span>
            </div>
          </div>
        </div>
        <button className="w-full p-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors">
          Edit Configuration
        </button>
      </div>
    </div>
  );
}
