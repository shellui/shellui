import { useTranslation } from "react-i18next"
import { useSettings } from "../hooks/useSettings"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { 
  isServiceWorkerRegistered, 
  updateServiceWorker,
  getServiceWorkerStatus,
  addStatusListener,
  serviceWorkerFileExists
} from "@/service-worker/register"
import { shellui } from "@shellui/sdk"
import { useState, useEffect } from "react"

export const ServiceWorker = () => {
  const { t } = useTranslation('settings')
  const { settings, updateSetting } = useSettings()
  const [isRegistered, setIsRegistered] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [swFileExists, setSwFileExists] = useState(true) // Track if service worker file exists

  const serviceWorkerEnabled = settings?.serviceWorker?.enabled ?? true

  useEffect(() => {
    // Don't check service worker status if disabled
    if (!serviceWorkerEnabled) {
      // Immediately clear all state and hide error messages
      setIsRegistered(false)
      setUpdateAvailable(false)
      setIsLoading(false)
      setSwFileExists(true) // Set to true to prevent error messages from showing
      return
    }

    // Initial check with loading state
    const initialCheck = async () => {
      // Double-check service worker is still enabled before proceeding
      const stillEnabled = settings?.serviceWorker?.enabled ?? true
      if (!stillEnabled) {
        setIsLoading(false)
        return
      }
      
      setIsLoading(true)
      
      // First check if service worker file exists
      const exists = await serviceWorkerFileExists()
      
      // Check again if service worker was disabled during the async operation
      const currentEnabled = settings?.serviceWorker?.enabled ?? true
      if (!currentEnabled) {
        setIsLoading(false)
        return
      }
      
      setSwFileExists(exists)
      
      if (exists) {
        // Check service worker status only if file exists
        const status = await getServiceWorkerStatus()
        
        // Final check before updating state
        const finalCheck = settings?.serviceWorker?.enabled ?? true
        if (finalCheck) {
          setIsRegistered(status.registered)
          setUpdateAvailable(status.updateAvailable)
        }
      } else {
        // File doesn't exist, so service worker can't be registered
        // Only update if service worker is still enabled
        const finalCheck = settings?.serviceWorker?.enabled ?? true
        if (finalCheck) {
          setIsRegistered(false)
          setUpdateAvailable(false)
        }
      }
      
      setIsLoading(false)
    }
    
    // Background refresh without affecting loading state
    const refreshStatus = async () => {
      // Skip if service worker was disabled (check current setting value)
      const currentEnabled = settings?.serviceWorker?.enabled ?? true
      if (!currentEnabled) {
        return
      }
      
      // Check if file exists first
      const exists = await serviceWorkerFileExists()
      
      // Check again if service worker was disabled during the async operation
      const currentEnabledAfter = settings?.serviceWorker?.enabled ?? true
      if (!currentEnabledAfter) {
        return
      }
      
      setSwFileExists(exists)
      
      if (exists) {
        // Check service worker status only if file exists
        const status = await getServiceWorkerStatus()
        
        // Final check before updating state
        const finalCheck = settings?.serviceWorker?.enabled ?? true
        if (finalCheck) {
          setIsRegistered(status.registered)
          setUpdateAvailable(status.updateAvailable)
        }
      } else {
        // File doesn't exist, so service worker can't be registered
        // Only update if service worker is still enabled
        const finalCheck = settings?.serviceWorker?.enabled ?? true
        if (finalCheck) {
          setIsRegistered(false)
          setUpdateAvailable(false)
        }
      }
    }
    
    // Initial check immediately
    initialCheck()
    
    // Listen for status changes
    const unsubscribe = addStatusListener((status) => {
      // Only update if service worker is still enabled (check current setting value)
      const currentEnabled = settings?.serviceWorker?.enabled ?? true
      if (currentEnabled) {
        setIsRegistered(status.registered)
        setUpdateAvailable(status.updateAvailable)
        setIsLoading(false)
      }
    })
    
    // Also check periodically as fallback (background refresh) - less frequent to avoid excessive fetches
    const interval = setInterval(refreshStatus, 30000) // Check every 30 seconds instead of 5
    
    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [serviceWorkerEnabled])

  const handleToggleServiceWorker = async (enabled: boolean) => {
    // Immediately clear all state before updating setting to prevent error flashes
    if (!enabled) {
      setIsRegistered(false)
      setUpdateAvailable(false)
      setSwFileExists(true) // Set to true to hide error messages immediately
      setIsLoading(false)
    }
    
    updateSetting('serviceWorker', { enabled })
    
    if (!enabled) {
      // Already cleared above, just return
      return
    }
    
    // Give it a moment to register/unregister
    setTimeout(async () => {
      // Double-check service worker is still enabled before updating state
      const currentEnabled = settings?.serviceWorker?.enabled ?? true
      if (enabled && currentEnabled) {
        const registered = await isServiceWorkerRegistered()
        setIsRegistered(registered)
      }
    }, 1000)
  }

  const handleUpdateNow = async () => {
    try {
      await updateServiceWorker()
      shellui.toast({
        title: t('caching.updateInstalling.title'),
        description: t('caching.updateInstalling.description'),
        type: 'info',
      })
    } catch (error) {
      shellui.toast({
        title: t('caching.updateError.title'),
        description: t('caching.updateError.description'),
        type: 'error',
      })
    }
  }

  const handleResetToLatest = async () => {
    try {
      // Clear all caches and reload
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }
      
      shellui.toast({
        title: t('caching.resetSuccess.title'),
        description: t('caching.resetSuccess.description'),
        type: 'success',
      })
      
      // Reload the app using shellUI refresh message (refreshes entire app, not just iframe)
      setTimeout(() => {
        const sent = shellui.sendMessageToParent({
          type: 'SHELLUI_REFRESH_PAGE',
          payload: {},
        })
        if (!sent) {
          // Fallback to window.location.reload if message can't be sent
          window.location.reload()
        }
      }, 1000)
    } catch (error) {
      shellui.toast({
        title: t('caching.resetError.title'),
        description: t('caching.resetError.description'),
        type: 'error',
      })
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">{t('caching.description')}</p>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">{t('caching.loading')}</div>
      ) : null}

      {!isLoading && (
        <div className="space-y-6">
          {/* Enable/Disable service worker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                  {t('caching.enabled.title')}
                </label>
                <p className="text-sm text-muted-foreground">
                  {serviceWorkerEnabled 
                    ? t('caching.enabled.descriptionEnabled')
                    : t('caching.enabled.descriptionDisabled')}
                </p>
              </div>
              <Switch
                checked={serviceWorkerEnabled}
                onCheckedChange={handleToggleServiceWorker}
              />
            </div>
          </div>

          {/* Status – always visible; shows Disabled when off */}
          <div className="space-y-2">
            <div className="space-y-0.5">
              <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                {t('caching.status.title')}
              </label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {!serviceWorkerEnabled ? (
                <span className="text-muted-foreground">
                  ○ {t('caching.status.disabled')}
                </span>
              ) : !swFileExists ? (
                <span className="text-red-600 dark:text-red-400">
                  ✗ {t('caching.status.fileNotFound')}
                </span>
              ) : (
                <>
                  <span className={isRegistered ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}>
                    {isRegistered ? "●" : "○"} {isRegistered ? t('caching.status.registered') : t('caching.status.notRunning')}
                  </span>
                  {updateAvailable && (
                    <>
                      <span className="text-muted-foreground/50">|</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        ● {t('caching.status.updateAvailable')}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {serviceWorkerEnabled && (
            <>
              {/* Error Message when file missing */}
              {!swFileExists && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium leading-none text-red-600 dark:text-red-400" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                      {t('caching.status.fileNotFound')}
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {t('caching.status.fileNotFoundDescription')}
                    </p>
                  </div>
                </div>
              )}

              {/* Update Available */}
              {updateAvailable && (
                <div className="space-y-2">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                      {t('caching.update.title')}
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {t('caching.update.description')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleUpdateNow}
                    className="w-full sm:w-auto"
                  >
                    {t('caching.update.button')}
                  </Button>
                </div>
              )}

              {/* Reset Cache */}
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                    {t('caching.reset.title')}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {t('caching.reset.description')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleResetToLatest}
                  className="w-full sm:w-auto"
                >
                  {t('caching.reset.button')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
