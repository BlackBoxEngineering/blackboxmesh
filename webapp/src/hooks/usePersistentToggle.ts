import { useEffect, useState } from 'react';

export function usePersistentToggle(key: string, initialValue = false) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(key) === 'true' || initialValue);

  useEffect(() => {
    localStorage.setItem(key, enabled.toString());
  }, [enabled, key]);

  const toggle = () => setEnabled((value) => !value);

  return [enabled, setEnabled, toggle] as const;
}
