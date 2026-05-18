import React from 'react';

interface MapControlsProps {
  onLocate?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export const MapControls: React.FC<MapControlsProps> = ({ onLocate, onZoomIn, onZoomOut }) => {
  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
      {onLocate && (
        <button
          onClick={onLocate}
          className="bg-white dark:bg-gray-800 p-2 rounded shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Locate me"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}
      {onZoomIn && (
        <button
          onClick={onZoomIn}
          className="bg-white dark:bg-gray-800 p-2 rounded shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Zoom in"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
      {onZoomOut && (
        <button
          onClick={onZoomOut}
          className="bg-white dark:bg-gray-800 p-2 rounded shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Zoom out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      )}
    </div>
  );
};