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
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(true) // Start as true, will be updated

  const cachingEnabled = settings?.caching?.enabled ?? true

  useEffect(() => {
    const checkStatus = async () => {
      setIsLoading(true)
      
      // Check if service worker file exists (development vs production)
      const swExists = await serviceWorkerFileExists()
      const isDev = !swExists
      setIsDevelopmentMode(isDev)
      
      // Only check service worker status if not in dev mode
      if (!isDev) {
        const status = await getServiceWorkerStatus()
        setIsRegistered(status.registered)
        setUpdateAvailable(status.updateAvailable)
      } else {
        setIsRegistered(false)
        setUpdateAvailable(false)
      }
      
      setIsLoading(false)
    }
    
    // Initial check immediately
    checkStatus()
    
    // Listen for status changes (only if not in dev mode)
    const unsubscribe = addStatusListener((status) => {
      if (!isDevelopmentMode) {
        setIsRegistered(status.registered)
        setUpdateAvailable(status.updateAvailable)
      }
      setIsLoading(false)
    })
    
    // Also check periodically as fallback
    const interval = setInterval(checkStatus, 5000)
    
    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [cachingEnabled, isDevelopmentMode])

  const handleToggleCaching = async (enabled: boolean) => {
    updateSetting('caching', { enabled })
    
    // Give it a moment to register/unregister
    setTimeout(async () => {
      const registered = await isServiceWorkerRegistered()
      setIsRegistered(registered)
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
      ) : (
        <>
          {isDevelopmentMode && (
            <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium leading-none text-orange-600 dark:text-orange-400" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                  {t('caching.developmentMode.title')}
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {t('caching.developmentMode.description')}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {!isLoading && !isDevelopmentMode && (
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
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                  {t('caching.status.title')}
                </h3>
                <div className="flex items-center gap-2 text-sm">
                  <span className={isRegistered ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                    {isRegistered ? "●" : "○"} {t('caching.status.registered')}
                  </span>
                  {updateAvailable && (
                    <>
                      <span className="text-muted-foreground/50">|</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        ● {t('caching.status.updateAvailable')}
                      </span>
                    </>
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
