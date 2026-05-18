import { useEffect, useState } from 'react';

export function useGoogleMapsApi() {
  const [googleMapsReady, setGoogleMapsReady] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey || window.google?.maps) {
      setGoogleMapsReady(!!window.google?.maps);
      return;
    }

    if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&loading=async`;
      script.async = true;
      script.onload = () => {
        console.log('Google Maps API loaded in MapView');
        setGoogleMapsReady(true);
      };
      script.onerror = () => {
        console.error('Failed to load Google Maps API in MapView');
      };
      document.head.appendChild(script);
    }
  }, []);

  return googleMapsReady;
}
