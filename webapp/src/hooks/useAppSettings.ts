import { useEffect, useState } from 'react';
import { appSettings, type AppSettings } from '../services/appSettings';

export function useAppSettings(): [AppSettings, (next: AppSettings) => void] {
  const [settings, setSettings] = useState<AppSettings>(() => appSettings.get());

  useEffect(() => appSettings.onChange(setSettings), []);

  return [settings, appSettings.set.bind(appSettings)];
}

