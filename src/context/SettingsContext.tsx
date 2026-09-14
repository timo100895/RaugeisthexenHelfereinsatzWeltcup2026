import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/services/supabase';
import type { AppSettings } from '@/types/database';

const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  org_name: 'Ornemer Raugeisthexen',
  logo_url: '/assets/raugeisthexen-logo.svg',
  color_primary: '#111111',
  color_secondary: '#c81e1e',
  color_accent: '#1f8a3b',
  default_capacity: 4,
  notify_emails: [],
  privacy_notice:
    'Deine Daten werden ausschließlich zur Organisation der Helfereinsätze verwendet.',
  updated_at: new Date().toISOString(),
};

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  refresh: async () => {},
});

function applyTheme(settings: AppSettings) {
  const root = document.documentElement;
  root.style.setProperty('--color-black', settings.color_primary);
  root.style.setProperty('--color-red', settings.color_secondary);
  root.style.setProperty('--color-green', settings.color_accent);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (!error && data) {
      setSettings(data as AppSettings);
      applyTheme(data as AppSettings);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
