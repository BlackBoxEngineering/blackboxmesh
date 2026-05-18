export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export class GPSService {
  private position: GPSPosition | null = null;
  private callbacks: ((position: GPSPosition | null) => void)[] = [];
  private intervalId: number | null = null;
  private enabled: boolean = false;

  constructor() {
    // Don't auto-start, wait for user to enable
  }

  public start() {
    if (this.enabled) return;
    this.enabled = true;

    // Browser geolocation is handled separately in App.tsx
    // Only use phone bridge here

    // Try phone bridge immediately and then every 10 seconds
    this.tryPhoneBridge();
    this.intervalId = window.setInterval(() => this.tryPhoneBridge(), 10000);
  }

  public stop() {
    this.enabled = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tryPhoneBridge() {
    if (!this.enabled || localStorage.getItem('gps-phone') === 'false') return;

    try {
      const response = await fetch('http://localhost:8080/gps', {
        signal: AbortSignal.timeout(2000)
      }).catch(() => null);
      
      if (response?.ok) {
        const data = await response.json();
        
        if (data.coords?.latitude && data.coords?.longitude) {
          const newPos = {
            latitude: data.coords.latitude,
            longitude: data.coords.longitude,
            accuracy: data.coords.accuracy || 10,
            timestamp: data.timestamp || Date.now()
          };
          this.position = newPos;
          this.notifyCallbacks();
        } else if (data.latitude && data.longitude) {
          const newPos = {
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy || 10,
            timestamp: data.timestamp || Date.now()
          };
          this.position = newPos;
          this.notifyCallbacks();
        }
      }
    } catch (error) {
      // Silently fail - phone bridge not available
    }
  }

  private notifyCallbacks() {
    this.callbacks.forEach(callback => callback(this.position));
  }

  public getCurrentPosition(): Promise<GPSPosition> {
    return new Promise((resolve, reject) => {
      if (this.position) {
        resolve(this.position);
        return;
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const gpsPos = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: Date.now()
            };
            resolve(gpsPos);
          },
          reject,
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        reject(new Error('No GPS available'));
      }
    });
  }

  public getLastKnownPosition(): GPSPosition | null {
    return this.position;
  }

  public subscribe(callback: (position: GPSPosition | null) => void) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  public destroy() {
    this.stop();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }
}

export const gpsService = new GPSService();