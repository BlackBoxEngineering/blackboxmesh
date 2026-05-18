import { useEffect, useRef } from 'react';

interface GPSComparisonMarkerProps {
  map: google.maps.Map | maplibregl.Map | null;
  position: { lat: number; lng: number };
  type: 'device' | 'browser';
  label: string;
  isGoogleMap?: boolean;
}

export const GPSComparisonMarker = ({ 
  map, 
  position, 
  type, 
  label,
  isGoogleMap = false 
}: GPSComparisonMarkerProps) => {
  const markerRef = useRef<google.maps.Marker | maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const color = type === 'device' ? '#EF4444' : '#3B82F6'; // red-500 : blue-500
    const emoji = type === 'device' ? '🔴' : '🔵';

    if (isGoogleMap && 'setCenter' in map) {
      // Google Maps marker
      const marker = new google.maps.Marker({
        position,
        map: map as google.maps.Map,
        title: label,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <div style="font-weight: bold;">${emoji} ${type === 'device' ? 'Device GPS' : 'Browser GPS'}</div>
            <div style="font-size: 12px; color: #666;">${label}</div>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map as google.maps.Map, marker);
      });

      markerRef.current = marker;
    } else if ('flyTo' in map) {
      // MapLibre marker
      const el = document.createElement('div');
      el.className = 'w-4 h-4 rounded-full border-2 border-white cursor-pointer transition-transform hover:scale-110';
      el.style.backgroundColor = color;
      el.style.boxShadow = `0 0 10px ${color}80`;
      el.title = label;

      const maplibreMap = map as maplibregl.Map;
      const marker = new (window as any).maplibregl.Marker({ element: el })
        .setLngLat([position.lng, position.lat])
        .setPopup(
          new (window as any).maplibregl.Popup({ offset: 15 })
            .setHTML(`
              <div style="padding: 8px;">
                <div style="font-weight: bold;">${emoji} ${type === 'device' ? 'Device GPS' : 'Browser GPS'}</div>
                <div style="font-size: 12px; color: #666;">${label}</div>
              </div>
            `)
        )
        .addTo(maplibreMap);

      markerRef.current = marker;
    }

    return () => {
      if (markerRef.current) {
        if ('setMap' in markerRef.current) {
          (markerRef.current as google.maps.Marker).setMap(null);
        } else if ('remove' in markerRef.current) {
          (markerRef.current as maplibregl.Marker).remove();
        }
      }
    };
  }, [map, position, type, label, isGoogleMap]);

  return null;
};
