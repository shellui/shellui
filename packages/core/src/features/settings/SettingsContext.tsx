import * as React from "react"

export interface Settings {
  developerFeatures: {
    enabled: boolean
  }
  // Add more settings here as needed
  // appearance: { ... }
  // notifications: { ... }
}

const STORAGE_KEY = 'shellui:settings'

const defaultSettings: Settings = {
  developerFeatures: {
    enabled: false
  }
}

interface SettingsContextValue {
  settings: Settings
  updateSettings: (updates: Partial<Settings>) => void
  updateSetting: <K extends keyof Settings>(
    key: K,
    updates: Partial<Settings[K]>
  ) => void
}

const SettingsContext = React.createContext<SettingsContextValue | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<Settings>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          // Merge with defaults to handle new settings
          return { ...defaultSettings, ...parsed }
        }
      } catch (error) {
        console.error('Failed to load settings from localStorage:', error)
      }
    }
    return defaultSettings
  })

  // Persist to localStorage whenever settings change
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      } catch (error) {
        console.error('Failed to save settings to localStorage:', error)
      }
    }
  }, [settings])

  const updateSettings = React.useCallback((updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  const updateSetting = React.useCallback(<K extends keyof Settings>(
    key: K,
    updates: Partial<Settings[K]>
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], ...updates }
    }))
  }, [])

  const value = React.useMemo(
    () => ({
      settings,
      updateSettings,
      updateSetting,
    }),
    [settings, updateSettings, updateSetting]
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = React.useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
