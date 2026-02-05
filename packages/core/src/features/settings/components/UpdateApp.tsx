import { useTranslation } from "react-i18next"
import { useConfig } from "@/features/config/useConfig"
import { useSettings } from "../hooks/useSettings"
import { Button } from "@/components/ui/button"
import {
  isTauri,
  getServiceWorkerStatus,
  addStatusListener,
  checkForServiceWorkerUpdate,
  updateServiceWorker,
} from "@/service-worker/register"
import { shellui } from "@shellui/sdk"
import { CheckIcon } from "../SettingsIcons"
import { useState, useEffect } from "react"

export const UpdateApp = () => {
  const { t } = useTranslation("settings")
  const { config } = useConfig()
  const { settings } = useSettings()
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [checking, setChecking] = useState(false)
  const [showUpToDateInButton, setShowUpToDateInButton] = useState(false)

  const serviceWorkerEnabled = settings?.serviceWorker?.enabled ?? true

  useEffect(() => {
    if (isTauri()) return
    const load = async () => {
      const status = await getServiceWorkerStatus()
      setUpdateAvailable(status.updateAvailable)
    }
    load()
    const unsubscribe = addStatusListener((status) => {
      setUpdateAvailable(status.updateAvailable)
      // If an update becomes available, hide the "You are up to date" message
      if (status.updateAvailable) {
        setShowUpToDateInButton(false)
      }
    })
    return unsubscribe
  }, [])

  const handleCheckForUpdate = async () => {
    if (isTauri()) return
    setShowUpToDateInButton(false)
    setChecking(true)
    try {
      // Check current status before triggering update check
      const initialStatus = await getServiceWorkerStatus()
      
      // If update is already available, don't show "You are up to date"
      if (initialStatus.updateAvailable) {
        return
      }
      
      // Trigger update check
      await checkForServiceWorkerUpdate()
      
      // Wait a bit for the update check to complete and status to update
      // The status listener will update updateAvailable if an update is found
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Check status again after update check
      // Use the state value which may have been updated by the status listener
      // If updateAvailable is true, don't show "You are up to date"
      if (!updateAvailable) {
        // Double-check with API to be sure
        const finalStatus = await getServiceWorkerStatus()
        if (!finalStatus.updateAvailable) {
          setShowUpToDateInButton(true)
          window.setTimeout(() => setShowUpToDateInButton(false), 3000)
        }
      }
    } finally {
      setChecking(false)
    }
  }

  const version = config?.version ?? t("updateApp.versionUnknown")

  if (isTauri()) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">{t("updateApp.description")}</p>
        <div className="space-y-2">
          <div className="space-y-0.5">
            <label className="text-sm font-medium leading-none" style={{ fontFamily: "var(--heading-font-family, inherit)" }}>
              {t("updateApp.currentVersion")}
            </label>
            <p className="text-sm text-muted-foreground">{version}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              {t("updateApp.tauriComingSoon")}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">{t("updateApp.description")}</p>
      <div className="space-y-4">
        <div className="space-y-0.5">
          <label className="text-sm font-medium leading-none" style={{ fontFamily: "var(--heading-font-family, inherit)" }}>
            {t("updateApp.currentVersion")}
          </label>
          <p className="text-sm text-muted-foreground">{version}</p>
        </div>
        {!serviceWorkerEnabled ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("updateApp.swDisabledMessage")}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                const sent = shellui.sendMessageToParent({
                  type: "SHELLUI_REFRESH_PAGE",
                  payload: {},
                })
                if (!sent) window.location.reload()
              }}
              className="w-full sm:w-auto"
            >
              {t("updateApp.refreshApp")}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-0.5">
              <label className="text-sm font-medium leading-none" style={{ fontFamily: "var(--heading-font-family, inherit)" }}>
                {t("updateApp.status")}
              </label>
              <div className="flex items-center gap-2 text-sm">
                {updateAvailable ? (
                  <span className="text-blue-600 dark:text-blue-400">
                    ● {t("updateApp.statusUpdateAvailable")}
                  </span>
                ) : (
                  <span className="text-green-600 dark:text-green-400">
                    ● {t("updateApp.statusUpToDate")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {updateAvailable && (
                <Button
                  variant="default"
                  onClick={async () => {
                    await updateServiceWorker();
                  }}
                  className="w-full sm:w-auto"
                >
                  {t("updateApp.installNow")}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleCheckForUpdate}
                disabled={checking}
                className="w-full sm:w-auto"
              >
                {checking ? (
                  <>
                    <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" aria-hidden />
                    {t("updateApp.checking")}
                  </>
                ) : showUpToDateInButton && !updateAvailable ? (
                  <span className="inline-flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckIcon />
                    {t("updateApp.youAreUpToDate")}
                  </span>
                ) : (
                  t("updateApp.checkForUpdate")
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
