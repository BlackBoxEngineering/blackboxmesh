export function ConfigView() {
  return (
    <>
      <h2 className="text-xl mb-4">Device Configuration</h2>
      <div className="space-y-4">
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-3">Radio Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Frequency (MHz)</label>
              <input type="number" defaultValue="868.0" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">TX Power (dBm)</label>
              <input type="number" defaultValue="14" max="14" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2" />
            </div>
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-3">Bridge Configuration</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">GPS Bridge URL</label>
              <input type="text" defaultValue="http://localhost:8080/gps" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">MQTT Bridge URL</label>
              <input type="text" defaultValue="http://localhost:8081/report" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2" />
            </div>
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-3">API Keys</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Google Maps API Key</label>
              <input type="password" placeholder="Enter your Google Maps API key" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2" />
            </div>
          </div>
        </div>

        <button className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          Save Configuration
        </button>
      </div>
    </>
  );
}
