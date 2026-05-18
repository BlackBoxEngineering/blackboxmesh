declare namespace google.maps {
  class Map {
    constructor(mapDiv: HTMLElement, opts?: MapOptions);
    setCenter(latlng: LatLng | LatLngLiteral): void;
    setZoom(zoom: number): void;
    panTo(latlng: LatLng | LatLngLiteral): void;
  }

  interface MapOptions {
    center?: LatLng | LatLngLiteral;
    zoom?: number;
    mapTypeId?: MapTypeId;
    mapTypeControl?: boolean;
    streetViewControl?: boolean;
    zoomControl?: boolean;
    fullscreenControl?: boolean;
    scaleControl?: boolean;
  }

  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  class LatLng {
    constructor(lat: number, lng: number);
  }

  enum MapTypeId {
    ROADMAP = 'roadmap',
    SATELLITE = 'satellite',
    HYBRID = 'hybrid',
    TERRAIN = 'terrain'
  }

  class Marker {
    constructor(opts?: MarkerOptions);
    setMap(map: Map | null): void;
    addListener(eventName: string, handler: Function): void;
  }

  interface MarkerOptions {
    position?: LatLng | LatLngLiteral;
    map?: Map;
    title?: string;
    icon?: any;
    zIndex?: number;
  }

  class InfoWindow {
    constructor(opts?: InfoWindowOptions);
    open(map: Map, anchor?: Marker): void;
  }

  interface InfoWindowOptions {
    content?: string;
  }

  class Polyline {
    constructor(opts?: PolylineOptions);
  }

  interface PolylineOptions {
    path?: Array<LatLng | LatLngLiteral>;
    geodesic?: boolean;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    map?: Map;
  }

  enum SymbolPath {
    CIRCLE = 0
  }

  namespace event {
    function addListenerOnce(instance: any, eventName: string, handler: Function): void;
  }
}
