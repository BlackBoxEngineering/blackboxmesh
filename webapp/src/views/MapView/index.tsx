import { useState } from 'react';
import { GoogleMap } from '../../components/GoogleMap';
import { Map } from '../../components/Map';
import { calculateDistance } from './calculateDistance';
import { useGoogleMapsApi } from './useGoogleMapsApi';
import { useMapGps } from './useMapGps';
import { useMeshNodes } from './useMeshNodes';
import { useMeshtastic } from '../../hooks/useMeshtastic';

export function MapView({ browserGeoEnabled }: { browserGeoEnabled: boolean }) {
  const [mapStyle, setMapStyle] = useState(() => localStorage.getItem('mapStyle') || 'osm');
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [osmMap, setOsmMap] = useState<any>(null);
  const googleMapsReady = useGoogleMapsApi();
  const { gpsPosition, browserGPS, deviceGPS } = useMapGps(browserGeoEnabled);
  const nodes = useMeshNodes();
  const { nodes: meshtasticNodes } = useMeshtastic();

  // Merge meshtastic nodes into the map nodes array with a 'meshtastic' flag
  const meshtasticMapNodes = meshtasticNodes
    .filter(n => typeof n.latitude === 'number' && typeof n.longitude === 'number')
    .map(n => ({
      id: n.shortName || n.longName || n.id,
      latitude: n.latitude as number,
      longitude: n.longitude as number,
      rssi: n.rssi ?? 0,
      snr: n.snr ?? 0,
      accuracy: 10,
      meshtastic: true,
      longName: n.longName,
      hwModel: n.hwModel,
      altitude: n.altitude,
    }));

  const allNodes = [...nodes, ...meshtasticMapNodes];

  const gpsDistance = deviceGPS && browserGPS
    ? calculateDistance(deviceGPS.latitude, deviceGPS.longitude, browserGPS.latitude, browserGPS.longitude)
    : null;

  const mapCenter = gpsPosition
    ? { lat: gpsPosition.latitude, lng: gpsPosition.longitude }
    : { lat: 35, lng: 0 };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl">BlackBoxMesh Map</h2>
          {gpsDistance !== null && gpsDistance > 50 && (
            <p className="text-xs text-yellow-400 mt-1">
              GPS discrepancy: {gpsDistance < 1000 ? `${gpsDistance.toFixed(0)}m` : `${(gpsDistance / 1000).toFixed(1)}km`} apart
            </p>
          )}
        </div>
        <select
          value={mapStyle}
          onChange={(event) => {
            const newStyle = event.target.value;
            setMapStyle(newStyle);
            localStorage.setItem('mapStyle', newStyle);
          }}
          className="bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm"
        >
          <option value="osm">OpenStreetMap</option>
          <option value="google">Google Maps</option>
          <option value="satellite">Satellite</option>
          <option value="hybrid">Hybrid</option>
          <option value="terrain">Terrain</option>
        </select>
      </div>

      <div className="h-full bg-gray-700 rounded-lg overflow-hidden relative">
        {mapStyle === 'osm' ? (
          <Map
            center={gpsPosition ? [gpsPosition.longitude, gpsPosition.latitude] : [0, 35]}
            zoom={gpsPosition ? 13 : 2}
            nodes={allNodes}
            browserGPS={browserGPS}
            deviceGPS={deviceGPS}
            onLoad={(map) => {
              setOsmMap(map);
              console.log('OSM Map loaded:', map);
            }}
          />
        ) : googleMapsReady ? (
          <div className="w-full h-full" key={mapStyle}>
            <GoogleMap
              center={mapCenter}
              zoom={gpsPosition ? 13 : 2}
              mapTypeId={mapStyle}
              nodes={allNodes}
              browserGPS={browserGPS}
              deviceGPS={deviceGPS}
              onLoad={(map) => {
                console.log('Google Map loaded, storing reference');
                setGoogleMap(map);

                if (deviceGPS && browserGPS) {
                  const deviceMarker = new google.maps.Marker({
                    position: { lat: deviceGPS.latitude, lng: deviceGPS.longitude },
                    map,
                    title: 'Phone GPS',
                    icon: {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 10,
                      fillColor: '#FB923C',
                      fillOpacity: 1,
                      strokeColor: '#FFFFFF',
                      strokeWeight: 3,
                    },
                    zIndex: 1000,
                  });

                  const deviceInfo = new google.maps.InfoWindow({
                    content: `<div style="padding:8px"><b>Phone GPS</b><br/>${deviceGPS.latitude.toFixed(6)}, ${deviceGPS.longitude.toFixed(6)}</div>`,
                  });
                  deviceMarker.addListener('click', () => deviceInfo.open(map, deviceMarker));

                  const browserMarker = new google.maps.Marker({
                    position: { lat: browserGPS.latitude, lng: browserGPS.longitude },
                    map,
                    title: 'Computer GPS',
                    icon: {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 10,
                      fillColor: '#C084FC',
                      fillOpacity: 1,
                      strokeColor: '#FFFFFF',
                      strokeWeight: 3,
                    },
                    zIndex: 1000,
                  });

                  const browserInfo = new google.maps.InfoWindow({
                    content: `<div style="padding:8px"><b>Computer GPS</b><br/>${browserGPS.latitude.toFixed(6)}, ${browserGPS.longitude.toFixed(6)}</div>`,
                  });
                  browserMarker.addListener('click', () => browserInfo.open(map, browserMarker));

                  if (gpsDistance && gpsDistance > 50) {
                    new google.maps.Polyline({
                      path: [
                        { lat: deviceGPS.latitude, lng: deviceGPS.longitude },
                        { lat: browserGPS.latitude, lng: browserGPS.longitude },
                      ],
                      geodesic: true,
                      strokeColor: '#FBBF24',
                      strokeOpacity: 0.8,
                      strokeWeight: 2,
                      map,
                    });
                  }
                }
              }}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-400">Loading Google Maps...</p>
            </div>
          </div>
        )}

        {(deviceGPS || browserGPS) && (
          <div className="absolute bottom-4 left-4 bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 text-xs space-y-1 max-w-xs">
            {deviceGPS && (
              <button
                onClick={() => {
                  console.log('Zooming to Device GPS:', deviceGPS, 'mapStyle:', mapStyle, 'googleMap:', !!googleMap, 'osmMap:', !!osmMap);
                  if (mapStyle === 'osm' && osmMap) {
                    osmMap.flyTo({
                      center: [deviceGPS.longitude, deviceGPS.latitude],
                      zoom: 15,
                      duration: 1000,
                    });
                  } else if (googleMap) {
                    googleMap.panTo({ lat: deviceGPS.latitude, lng: deviceGPS.longitude });
                    googleMap.setZoom(15);
                  } else {
                    console.log('No map reference available');
                  }
                }}
                className="flex items-start gap-2 w-full text-left hover:bg-gray-700/50 p-2 rounded transition-colors cursor-pointer"
              >
                <span className="text-orange-400">&bull;</span>
                <div>
                  <div className="font-medium text-orange-400">Phone GPS</div>
                  <div className="text-gray-300">{deviceGPS.latitude.toFixed(6)}, {deviceGPS.longitude.toFixed(6)}</div>
                </div>
              </button>
            )}
            {browserGPS && (
              <button
                onClick={() => {
                  console.log('Zooming to Browser GPS:', browserGPS, 'mapStyle:', mapStyle, 'googleMap:', !!googleMap, 'osmMap:', !!osmMap);
                  if (mapStyle === 'osm' && osmMap) {
                    osmMap.flyTo({
                      center: [browserGPS.longitude, browserGPS.latitude],
                      zoom: 15,
                      duration: 1000,
                    });
                  } else if (googleMap) {
                    googleMap.panTo({ lat: browserGPS.latitude, lng: browserGPS.longitude });
                    googleMap.setZoom(15);
                  } else {
                    console.log('No map reference available');
                  }
                }}
                className="flex items-start gap-2 w-full text-left hover:bg-gray-700/50 p-2 rounded transition-colors cursor-pointer"
              >
                <span className="text-purple-400">&bull;</span>
                <div>
                  <div className="font-medium text-purple-400">Computer GPS</div>
                  <div className="text-gray-300">{browserGPS.latitude.toFixed(6)}, {browserGPS.longitude.toFixed(6)}</div>
                </div>
              </button>
            )}
            {gpsDistance !== null && gpsDistance > 50 && (
              <div className="pt-2 border-t border-gray-600">
                <div className="text-yellow-400">
                  Distance: {gpsDistance < 1000 ? `${gpsDistance.toFixed(0)}m` : `${(gpsDistance / 1000).toFixed(1)}km`}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
