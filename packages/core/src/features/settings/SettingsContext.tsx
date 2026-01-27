import * as React from "react"
import { getLogger, shellui, ShellUIMessage } from "@shellui/sdk"

const logger = getLogger('shellcore')

export interface Settings {
  developerFeatures: {
    enabled: boolean
  }
  logging: {
    namespaces: {
      shellsdk: boolean
      shellcore: boolean
    }
  }
  appearance: {
    theme: 'light' | 'dark' | 'system'
    themeName: string
  }
  language: {
    code: 'en' | 'fr'
  }
  region: {
    timezone: string
  }
  // Add more settings here as needed
  // notifications: { ... }
}

const STORAGE_KEY = 'shellui:settings'

// Get browser's timezone as default
const getBrowserTimezone = (): string => {
  if (typeof window !== 'undefined' && Intl) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  }
  return 'UTC'
}

const defaultSettings: Settings = {
  developerFeatures: {
    enabled: false
  },
  logging: {
    namespaces: {
      shellsdk: false,
      shellcore: false
    }
  },
  appearance: {
    theme: 'system',
    themeName: 'default'
  },
  language: {
    code: 'en'
  },
  region: {
    timezone: getBrowserTimezone()
  }
}

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

export function SettingsProvider({ children }: { children: React.ReactNode }) {

  const [settings, setSettings] = React.useState<Settings>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          // Deep merge with defaults to handle new settings
          return {
            ...defaultSettings,
            ...parsed,
            logging: {
              namespaces: {
                ...defaultSettings.logging.namespaces,
                ...parsed.logging?.namespaces
              }
            },
            appearance: {
              theme: parsed.appearance?.theme || defaultSettings.appearance.theme,
              themeName: parsed.appearance?.themeName || defaultSettings.appearance.themeName
            },
            language: {
              code: parsed.language?.code || defaultSettings.language.code
            },
            region: {
              // Only use stored timezone if it exists, otherwise use browser's current timezone
              timezone: parsed.region?.timezone || getBrowserTimezone()
            }
          }
        }
      } catch (error) {
        logger.error('Failed to load settings from localStorage:', { error })
      }
    }
    return defaultSettings
  })

  // Listen for settings updates from parent/other nodes
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const cleanup = shellui.addMessageListener('SHELLUI_SETTINGS_UPDATED', (data) => {
      const message = data as ShellUIMessage;
      const payload = message.payload as { settings: Settings }
      const newSettings = payload.settings
      if (newSettings) {
        // Update localStorage with new settings value
        setSettings(newSettings);
        if (window.parent === window) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
            // Confirm: root updated localStorage
            // Update state to reflect the new settings
            logger.info('Root Parent received settings update', message)
            shellui.propagateMessage({
              type: 'SHELLUI_SETTINGS',
              payload: { settings: newSettings }
            })
          } catch (error) {
            logger.error('Failed to update settings from message:', { error })
          }
        }
      }
    });

    const cleanupSettings = shellui.addMessageListener('SHELLUI_SETTINGS', (data) => {
      const message = data as ShellUIMessage;
      const payload = message.payload as { settings: Settings }
      const newSettings = payload.settings
      if (newSettings) {
        setSettings(newSettings)
      }
    })

    return () => {
      cleanup()
      cleanupSettings()
    }
  }, [])


  // ACTIONS
  const updateSettings = React.useCallback((updates: Partial<Settings>) => {
    const newSettings = { ...settings, ...updates }
    
    // Update localStorage immediately if we're in the root window
    if (typeof window !== 'undefined' && window.parent === window) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
        setSettings(newSettings)
      } catch (error) {
        logger.error('Failed to update settings in localStorage:', { error })
      }
    }
    
    shellui.sendMessageToParent({
      type: 'SHELLUI_SETTINGS_UPDATED',
      payload: { settings: newSettings }
    })
  }, [settings])

  const updateSetting = React.useCallback(<K extends keyof Settings>(
    key: K,
    updates: Partial<Settings[K]>
  ) => {
    // Deep merge: preserve existing nested properties
    const currentValue = settings[key]
    const mergedValue = typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)
      ? { ...currentValue, ...updates }
      : updates
    updateSettings({ [key]: mergedValue } as Partial<Settings>)
  }, [settings, updateSettings])

  const resetAllData = React.useCallback(() => {
    // Clear all localStorage data
    if (typeof window !== 'undefined') {
      try {
        // Clear settings
        localStorage.removeItem(STORAGE_KEY)
        
        // Clear all other localStorage items that start with shellui:
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('shellui:')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
        
        // Reset settings to defaults
        const newSettings = defaultSettings
        setSettings(newSettings)
        
        // If we're in the root window, update localStorage with defaults
        if (window.parent === window) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
          shellui.propagateMessage({
            type: 'SHELLUI_SETTINGS',
            payload: { settings: newSettings }
          })
        }
        
        // Notify parent about reset
        shellui.sendMessageToParent({
          type: 'SHELLUI_SETTINGS_UPDATED',
          payload: { settings: newSettings }
        })
        
        logger.info('All app data has been reset')
      } catch (error) {
        logger.error('Failed to reset all data:', { error })
      }
    }
  }, [])

  const value = React.useMemo(
    () => ({
      settings,
      updateSettings,
      updateSetting,
      resetAllData,
    }),
    [settings, updateSettings, updateSetting, resetAllData]
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
