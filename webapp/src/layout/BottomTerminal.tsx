export function BottomTerminal() {
  return (
    <div className="h-48 bg-black border-t border-gray-700 flex flex-col">
      <div className="p-2 bg-gray-800 border-b border-gray-700">
        <h3 className="text-sm font-semibold">Terminal</h3>
      </div>
      <div className="flex-1 p-3 font-mono text-sm overflow-y-auto">
        <div className="text-green-400">BlackBoxMesh Terminal v1.0</div>
        <div className="text-gray-400">Connected to Node 0x9E9E139C</div>
        <div className="text-blue-400">&gt; Ready for commands...</div>
      </div>
      <div className="p-3 border-t border-gray-700">
        <input
          type="text"
          placeholder="Type message or command..."
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}
