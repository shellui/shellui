import * as React from "react"
import { notifyParentSettingsUpdate } from "./notifyParentSettingsUpdate"

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

  const [isInitialMount, setIsInitialMount] = React.useState(true)
  
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

  // Listen for settings updates from parent/other nodes
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      console.log('handleMessage', event)
      if (window.parent !== window) {
        return
      }
      if (event.data?.type === 'SHELLUI_SETTINGS_UPDATED') {
        const newSettings = event.data.payload?.settings
        if (newSettings) {
          // Update localStorage with new settings value
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
            // Confirm: root updated localStorage
            // Update state to reflect the new settings
            setSettings(newSettings)
            // TODO: propagate to all nodes
            console.log('Root Parent received settings update:', newSettings, window.location.pathname) 
          } catch (error) {
            console.error('Failed to update settings from message:', error)
          }
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Persist to localStorage whenever settings change
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
        // Notify parent of settings update (skip on initial mount)
        if (!isInitialMount && window.parent !== window) {
          notifyParentSettingsUpdate(settings)
        }
        setIsInitialMount(false)
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
