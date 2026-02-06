import { useContext, createContext } from 'react';
import type { Settings } from '@shellui/sdk';

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
  updateSetting: <K extends keyof Settings>(key: K, updates: Partial<Settings[K]>) => void;
  resetAllData: () => void;
}

export const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
