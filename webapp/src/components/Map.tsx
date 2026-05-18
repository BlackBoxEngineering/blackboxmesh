import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapControls } from './Map/MapControls';

interface MapProps {
  onLoad?: (map: maplibregl.Map) => void;
  center?: [number, number];
  zoom?: number;
  style?: string;
  nodes?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    rssi?: number;
    snr?: number;
    accuracy?: number;
    meshtastic?: boolean;
    longName?: string;
    hwModel?: string;
    altitude?: number;
  }>;
  browserGPS?: { latitude: number; longitude: number } | null;
  deviceGPS?: { latitude: number; longitude: number } | null;
}

export const Map = ({ 
  onLoad, 
  center = [0, 35], 
  zoom = 2,
  style = 'https://tiles.openfreemap.org/styles/liberty',
  nodes = [],
  browserGPS = null,
  deviceGPS = null
}: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const gpsMarkers = useRef<maplibregl.Marker[]>([]);
  const hasSetInitialCenter = useRef(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center,
      zoom
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    // Suppress MapLibre tile loading errors
    map.current.on('error', (e) => {
      // Suppress common tile loading errors
      const msg = e.error?.message || '';
      if (msg.includes('could not be loaded') || 
          msg.includes('Expected value to be of type number') ||
          msg.includes('tile') ||
          msg.includes('source')) {
        return;
      }
      console.error('Map error:', e);
    });

    map.current.on('load', () => {
      console.log('✅ OSM Map loaded successfully');
      if (onLoad && map.current) {
        onLoad(map.current);
      }
    });

    return () => {
      markers.current.forEach(marker => marker.remove());
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [style]);

  // Update markers when nodes change
  useEffect(() => {
    if (!map.current) return;

    // Remove old markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add new markers
    nodes.forEach(node => {
      if (typeof node.latitude !== 'number' || typeof node.longitude !== 'number') return;
      const idStr = String(node.id ?? '????');
      const shortId = idStr.length >= 4 ? idStr.slice(-4).toUpperCase() : idStr.toUpperCase();
      const isMeshtastic = (node as any).meshtastic === true;
      const el = document.createElement('div');
      el.className = `w-8 h-8 ${isMeshtastic ? 'bg-green-500' : 'bg-orange-500'} rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform`;
      el.innerHTML = `<span class="text-white text-xs font-bold">${shortId}</span>`;

      const popupContent = isMeshtastic
        ? `<div class="p-2">
            <div class="font-bold">📻 Meshtastic: ${(node as any).longName ?? idStr}</div>
            ${(node as any).hwModel ? `<div class="text-xs text-gray-600">HW: ${(node as any).hwModel}</div>` : ''}
            <div class="text-xs text-gray-600 mt-1">Lat: ${node.latitude.toFixed(6)}</div>
            <div class="text-xs text-gray-600">Lng: ${node.longitude.toFixed(6)}</div>
            ${(node as any).altitude != null ? `<div class="text-xs text-gray-600">Alt: ${(node as any).altitude}m</div>` : ''}
            ${node.rssi ? `<div class="text-sm mt-1">RSSI: ${node.rssi} dBm</div>` : ''}
            ${node.snr ? `<div class="text-sm">SNR: ${node.snr} dB</div>` : ''}
          </div>`
        : `<div class="p-2">
            <div class="font-bold">📡 Node ${idStr}</div>
            <div class="text-xs text-gray-600 mt-1">Lat: ${node.latitude.toFixed(6)}</div>
            <div class="text-xs text-gray-600">Lng: ${node.longitude.toFixed(6)}</div>
            ${node.accuracy ? `<div class="text-xs text-gray-600">Accuracy: ±${node.accuracy.toFixed(1)}m</div>` : ''}
            ${node.rssi ? `<div class="text-sm mt-1">RSSI: ${node.rssi} dBm</div>` : ''}
            ${node.snr ? `<div class="text-sm">SNR: ${node.snr} dB</div>` : ''}
          </div>`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([node.longitude, node.latitude])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupContent))
        .addTo(map.current!);

      markers.current.push(marker);
    });

    console.log(`📍 Updated ${nodes.length} node markers on OSM Map`);
  }, [nodes]);

  // Add GPS comparison markers for OSM
  useEffect(() => {
    if (!map.current) return;

    // Remove old GPS markers
    gpsMarkers.current.forEach(marker => marker.remove());
    gpsMarkers.current = [];

    // Add device GPS marker (orange)
    if (deviceGPS) {
      const deviceEl = document.createElement('div');
      deviceEl.className = 'w-4 h-4 rounded-full border-2 border-white cursor-pointer transition-transform hover:scale-110';
      deviceEl.style.backgroundColor = '#FB923C';
      deviceEl.style.boxShadow = '0 0 10px rgba(251, 146, 60, 0.5)';
      deviceEl.title = '🟠 Phone GPS';

      const deviceMarker = new maplibregl.Marker({ element: deviceEl })
        .setLngLat([deviceGPS.longitude, deviceGPS.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 15 })
            .setHTML(`<div style="padding:8px"><b>🟠 Phone GPS</b><br/>${deviceGPS.latitude.toFixed(6)}, ${deviceGPS.longitude.toFixed(6)}</div>`)
        )
        .addTo(map.current);
      gpsMarkers.current.push(deviceMarker);
    }

    // Add browser GPS marker (purple)
    if (browserGPS) {
      const browserEl = document.createElement('div');
      browserEl.className = 'w-4 h-4 rounded-full border-2 border-white cursor-pointer transition-transform hover:scale-110';
      browserEl.style.backgroundColor = '#C084FC';
      browserEl.style.boxShadow = '0 0 10px rgba(192, 132, 252, 0.5)';
      browserEl.title = '🟣 Computer GPS';

      const browserMarker = new maplibregl.Marker({ element: browserEl })
        .setLngLat([browserGPS.longitude, browserGPS.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 15 })
            .setHTML(`<div style="padding:8px"><b>🟣 Computer GPS</b><br/>${browserGPS.latitude.toFixed(6)}, ${browserGPS.longitude.toFixed(6)}</div>`)
        )
        .addTo(map.current);
      gpsMarkers.current.push(browserMarker);
      console.log('🟣 Added Computer GPS marker to OSM at:', browserGPS.latitude, browserGPS.longitude);
    }
  }, [browserGPS, deviceGPS]);

  const handleLocate = () => {
    if (navigator.geolocation && map.current) {
      navigator.geolocation.getCurrentPosition((position) => {
        const coords = [position.coords.longitude, position.coords.latitude];
        console.log('📍 Locating to:', coords);
        map.current?.flyTo({
          center: coords as [number, number],
          zoom: 13
        });
      });
    }
  };

  // Update map center only on initial load
  useEffect(() => {
    if (map.current && center && !hasSetInitialCenter.current && center[0] !== 0 && center[1] !== 35) {
      console.log('🗺️ Setting initial OSM Map center to:', center);
      map.current.flyTo({
        center: center as [number, number],
        zoom: 13,
        duration: 1000
      });
      hasSetInitialCenter.current = true;
    }
  }, [center[0], center[1]]);

  const handleZoomIn = () => {
    if (map.current) {
      map.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (map.current) {
      map.current.zoomOut();
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      <MapControls 
        onLocate={handleLocate}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />
    </div>
  );
};