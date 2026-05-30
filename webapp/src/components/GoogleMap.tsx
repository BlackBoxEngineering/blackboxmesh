import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';

interface GoogleMapProps {
  children?: React.ReactNode;
  onLoad?: (map: google.maps.Map) => void;
  mapTypeId?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  nodes?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    rssi?: number;
    snr?: number;
    accuracy?: number;
  }>;
  browserGPS?: { latitude: number; longitude: number } | null;
  deviceGPS?: { latitude: number; longitude: number } | null;
}

export const GoogleMap = ({ 
  children, 
  onLoad, 
  mapTypeId = 'roadmap',
  center = { lat: 35, lng: 0 },
  zoom = 2,
  nodes = [],
  browserGPS = null,
  deviceGPS = null
}: GoogleMapProps) => {
  const [settings] = useAppSettings();
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const gpsMarkersRef = useRef<google.maps.Marker[]>([]);
  const hasSetInitialCenter = useRef(false);

  useEffect(() => {
    const apiKey = settings.googleMapsApiKey;
    
    if (!apiKey) {
      setError('Google Maps API key not found');
      setLoading(false);
      return;
    }

    const loadGoogleMaps = () => {
      if (window.google?.maps) {
        setLoading(false);
        return;
      }

      if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&loading=async`;
        script.async = true;
        script.onload = () => {
          console.log('Google Maps script loaded');
          setLoading(false);
        };
        script.onerror = () => {
          console.error('Failed to load Google Maps script');
          setError('Failed to load Google Maps API');
          setLoading(false);
        };
        document.head.appendChild(script);
        
        // Timeout fallback
        setTimeout(() => {
          if (!window.google?.maps) {
            setError('Google Maps API timeout');
            setLoading(false);
          }
        }, 10000);
      } else {
        // Script exists, wait for it
        const checkInterval = setInterval(() => {
          if (window.google?.maps) {
            clearInterval(checkInterval);
            setLoading(false);
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!window.google?.maps) {
            setError('Google Maps API timeout');
            setLoading(false);
          }
        }, 10000);
      }
    };

    loadGoogleMaps();
  }, [settings.googleMapsApiKey]);

  useLayoutEffect(() => {
    if (!mapRef.current || loading) return;
    if (!window.google?.maps?.Map || !window.google?.maps?.MapTypeId) return;

    const getMapTypeId = () => {
      switch (mapTypeId) {
        case 'satellite': return 'satellite';
        case 'hybrid': return 'hybrid';
        case 'terrain': return 'terrain';
        default: return 'roadmap';
      }
    };

    try {
      console.log('🗺️ Initializing Google Map with center:', center, 'zoom:', zoom);
      const mapInstance = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapTypeId: getMapTypeId() as any,
        mapTypeControl: true,
        streetViewControl: true,
        zoomControl: true,
        fullscreenControl: true,
        scaleControl: true
      });

      google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
        console.log('✅ Google Map idle - ready');
        setError(null);
      });

      setMap(mapInstance);
      if (onLoad) onLoad(mapInstance);
    } catch (err: any) {
      console.error('❌ Google Map initialization error:', err);
      setError(`Failed to initialize map: ${err.message}`);
    }
  }, [loading, mapTypeId]);

  // Update markers when nodes change
  useLayoutEffect(() => {
    if (!map || !window.google?.maps) return;

    // Remove old markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add new markers
    nodes.forEach(node => {
      const marker = new google.maps.Marker({
        position: { lat: node.latitude, lng: node.longitude },
        map: map,
        title: `Node ${node.id}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#FB923C',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <div style="font-weight: bold;">📡 Node ${node.id}</div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">Lat: ${node.latitude.toFixed(6)}</div>
            <div style="font-size: 12px; color: #666;">Lng: ${node.longitude.toFixed(6)}</div>
            ${node.accuracy ? `<div style="font-size: 12px; color: #666;">Accuracy: ±${node.accuracy.toFixed(1)}m</div>` : ''}
            ${node.rssi ? `<div style="font-size: 12px; margin-top: 4px;">RSSI: ${node.rssi} dBm</div>` : ''}
            ${node.snr ? `<div style="font-size: 12px;">SNR: ${node.snr} dB</div>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    console.log(`📍 Updated ${nodes.length} node markers on Google Map`);
  }, [map, nodes]);

  // Update map center only on initial load
  useEffect(() => {
    if (map && center && !hasSetInitialCenter.current && center.lat !== 35) {
      console.log('🗺️ Setting initial Google Map center to:', center);
      map.setCenter(center);
      map.setZoom(13);
      hasSetInitialCenter.current = true;
    }
  }, [map, center.lat, center.lng]);

  // Update zoom when zoom prop changes
  useEffect(() => {
    if (map && zoom) {
      map.setZoom(zoom);
    }
  }, [map, zoom]);

  // Add GPS comparison markers
  useEffect(() => {
    if (!map || !window.google?.maps) return;

    // Remove old GPS markers
    gpsMarkersRef.current.forEach(marker => marker.setMap(null));
    gpsMarkersRef.current = [];

    // Add device GPS marker (orange)
    if (deviceGPS) {
      const deviceMarker = new google.maps.Marker({
        position: { lat: deviceGPS.latitude, lng: deviceGPS.longitude },
        map: map,
        title: '🟠 Phone GPS',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#FB923C',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3
        },
        zIndex: 1000
      });
      gpsMarkersRef.current.push(deviceMarker);
    }

    // Add browser GPS marker (purple)
    if (browserGPS) {
      const browserMarker = new google.maps.Marker({
        position: { lat: browserGPS.latitude, lng: browserGPS.longitude },
        map: map,
        title: '🟣 Computer GPS',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#C084FC',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3
        },
        zIndex: 1000
      });
      gpsMarkersRef.current.push(browserMarker);
      console.log('🟣 Added Computer GPS marker at:', browserGPS.latitude, browserGPS.longitude);
    }
  }, [map, browserGPS, deviceGPS]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
        <div className="text-center p-4">
          <div className="text-red-600 dark:text-red-400 mb-2">⚠️</div>
          <p className="text-sm text-red-700 dark:text-red-300 mb-2">Google Maps Error</p>
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const handleLocate = () => {
    if (navigator.geolocation && map) {
      navigator.geolocation.getCurrentPosition((position) => {
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        console.log('📍 Locating to:', pos);
        map.setCenter(pos);
        map.setZoom(13);
      });
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {map && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button
            onClick={handleLocate}
            className="bg-white p-2 rounded shadow hover:bg-gray-100"
            title="Locate me"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      )}
      {children}
    </div>
  );
};
