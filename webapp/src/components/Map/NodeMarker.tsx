import React from 'react';

interface NodeMarkerProps {
  nodeId: string;
  position: { lat: number; lng: number };
  isMyNode?: boolean;
  rssi?: number;
  snr?: number;
  onClick?: () => void;
}

export const NodeMarker: React.FC<NodeMarkerProps> = ({ 
  nodeId, 
  position, 
  isMyNode = false,
  rssi,
  onClick 
}) => {
  const getSignalColor = () => {
    if (!rssi) return 'bg-gray-500';
    if (rssi > -80) return 'bg-green-500';
    if (rssi > -100) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      style={{ left: `${position.lng}px`, top: `${position.lat}px` }}
      onClick={onClick}
    >
      <div className={`w-8 h-8 rounded-full ${isMyNode ? 'bg-blue-500 animate-pulse' : getSignalColor()} border-2 border-white shadow-lg flex items-center justify-center`}>
        <span className="text-white text-xs font-bold">
          {nodeId.slice(-4).toUpperCase()}
        </span>
      </div>
      {rssi && (
        <div className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          {rssi} dBm
        </div>
      )}
    </div>
  );
};