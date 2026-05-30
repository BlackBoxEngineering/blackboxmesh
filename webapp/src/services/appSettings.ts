export interface AppSettings {
  gpsBridgeBaseUrl: string;
  mqttBridgeBaseUrl: string;
  googleMapsApiKey: string;
  radioFrequencyMhz: number;
  radioTxPowerDbm: number;
}

const STORAGE_KEY = 'app.settings.v1';

const DEFAULTS: AppSettings = {
  gpsBridgeBaseUrl: (import.meta.env.VITE_GPS_BRIDGE_URL as string | undefined) || 'http://localhost:8080',
  mqttBridgeBaseUrl: (import.meta.env.VITE_MQTT_BRIDGE_URL as string | undefined) || 'http://localhost:8081',
  googleMapsApiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '',
  radioFrequencyMhz: 868.0,
  radioTxPowerDbm: 14,
};

type SettingsCb = (settings: AppSettings) => void;

class AppSettingsStore {
  private cbs: SettingsCb[] = [];

  get(): AppSettings {
    if (typeof localStorage === 'undefined') return DEFAULTS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULTS;
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        gpsBridgeBaseUrl: parsed.gpsBridgeBaseUrl || DEFAULTS.gpsBridgeBaseUrl,
        mqttBridgeBaseUrl: parsed.mqttBridgeBaseUrl || DEFAULTS.mqttBridgeBaseUrl,
        googleMapsApiKey: parsed.googleMapsApiKey || DEFAULTS.googleMapsApiKey,
        radioFrequencyMhz: Number.isFinite(parsed.radioFrequencyMhz) ? Number(parsed.radioFrequencyMhz) : DEFAULTS.radioFrequencyMhz,
        radioTxPowerDbm: Number.isFinite(parsed.radioTxPowerDbm) ? Number(parsed.radioTxPowerDbm) : DEFAULTS.radioTxPowerDbm,
      };
    } catch {
      return DEFAULTS;
    }
  }

  set(next: AppSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.emit(next);
  }

  onChange(cb: SettingsCb): () => void {
    this.cbs.push(cb);
    cb(this.get());
    return () => {
      this.cbs = this.cbs.filter((x) => x !== cb);
    };
  }

  private emit(settings: AppSettings): void {
    for (const cb of this.cbs) cb(settings);
  }
}

export const appSettings = new AppSettingsStore();

