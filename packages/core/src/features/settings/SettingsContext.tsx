import * as React from "react"
import { Settings } from "@shellui/sdk"

interface SettingsContextValue {
  settings: Settings
  updateSettings: (updates: Partial<Settings>) => void
  updateSetting: <K extends keyof Settings>(
    key: K,
    updates: Partial<Settings[K]>
  ) => void
  resetAllData: () => void
}

export const SettingsContext = React.createContext<SettingsContextValue | undefined>(undefined)

export function useSettings() {
  const context = React.useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
