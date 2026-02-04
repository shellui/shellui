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

export const Caching = () => {
  const { t } = useTranslation('settings')
  const { settings, updateSetting } = useSettings()
  const [isRegistered, setIsRegistered] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [swFileExists, setSwFileExists] = useState(true) // Track if service worker file exists

  const cachingEnabled = settings?.caching?.enabled ?? true

  useEffect(() => {
    // Don't check service worker status if caching is disabled
    if (!cachingEnabled) {
      setIsRegistered(false)
      setUpdateAvailable(false)
      setIsLoading(false)
      setSwFileExists(false)
      return
    }

    // Initial check with loading state
    const initialCheck = async () => {
      setIsLoading(true)
      
      // First check if service worker file exists
      const exists = await serviceWorkerFileExists()
      setSwFileExists(exists)
      
      if (exists) {
        // Check service worker status only if file exists
        const status = await getServiceWorkerStatus()
        setIsRegistered(status.registered)
        setUpdateAvailable(status.updateAvailable)
      } else {
        // File doesn't exist, so service worker can't be registered
        setIsRegistered(false)
        setUpdateAvailable(false)
      }
      
      setIsLoading(false)
    }
    
    // Background refresh without affecting loading state
    const refreshStatus = async () => {
      // Skip if caching was disabled (check current setting value)
      const currentCachingEnabled = settings?.caching?.enabled ?? true
      if (!currentCachingEnabled) {
        return
      }
      
      // Check if file exists first
      const exists = await serviceWorkerFileExists()
      setSwFileExists(exists)
      
      if (exists) {
        // Check service worker status only if file exists
        const status = await getServiceWorkerStatus()
        setIsRegistered(status.registered)
        setUpdateAvailable(status.updateAvailable)
      } else {
        // File doesn't exist, so service worker can't be registered
        setIsRegistered(false)
        setUpdateAvailable(false)
      }
    }
    
    // Initial check immediately
    initialCheck()
    
    // Listen for status changes
    const unsubscribe = addStatusListener((status) => {
      // Only update if caching is still enabled (check current setting value)
      const currentCachingEnabled = settings?.caching?.enabled ?? true
      if (currentCachingEnabled) {
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
  }, [cachingEnabled])

  const handleToggleCaching = async (enabled: boolean) => {
    updateSetting('caching', { enabled })
    
    if (!enabled) {
      // Immediately clear status when disabled
      setIsRegistered(false)
      setUpdateAvailable(false)
      setSwFileExists(false)
      return
    }
    
    // Give it a moment to register/unregister
    setTimeout(async () => {
      if (enabled) {
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
      
      // Reload the page to get latest version
      setTimeout(() => {
        window.location.reload()
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
        <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div className="space-y-0.5">
            <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
              {t('caching.enabled.title')}
            </label>
            <p className="text-sm text-muted-foreground">
              {cachingEnabled 
                ? t('caching.enabled.descriptionEnabled')
                : t('caching.enabled.descriptionDisabled')}
            </p>
          </div>
          <Switch
            checked={cachingEnabled}
            onCheckedChange={handleToggleCaching}
          />
        </div>

        {cachingEnabled && (
          <>
            {!swFileExists && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium leading-none text-red-600 dark:text-red-400" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                    Service Worker Not Available
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    The service worker file could not be found. Caching is not available. This may be a development server issue.
                  </p>
                </div>
              </div>
            )}
            
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                  {t('caching.status.title')}
                </h3>
                <div className="flex items-center gap-2 text-sm">
                  {swFileExists ? (
                    <>
                      <span className={isRegistered ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}>
                        {isRegistered ? "●" : "○"} {isRegistered ? t('caching.status.registered') : 'Not Running'}
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
                  ) : (
                    <span className="text-red-600 dark:text-red-400">
                      ✗ Failed - Service worker file not found
                    </span>
                  )}
                </div>
              </div>
            </div>

            {updateAvailable && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                    {t('caching.update.title')}
                  </h3>
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

            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                  {t('caching.reset.title')}
                </h3>
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
