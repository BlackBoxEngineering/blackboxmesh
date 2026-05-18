export function NodeStatusPanel() {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3 text-gray-300">Node Status</h3>
      <div className="space-y-3">
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-sm text-gray-300">Node 0x9E9E139C</div>
          <div className="text-green-400">Online</div>
        </div>
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-sm text-gray-300">Routes: 2</div>
          <div className="text-sm text-gray-300">RSSI: -45 dBm</div>
        </div>
      </div>
    </div>
  );
}
