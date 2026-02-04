import { useTranslation } from "react-i18next"
import { useSettings } from "../hooks/useSettings"
import { useConfig } from "@/features/config/useConfig"
import { Button } from "@/components/ui/button"
import { shellui } from "@shellui/sdk"

export const DataPrivacy = () => {
  const { t } = useTranslation('settings')
  const { config } = useConfig()
  const { settings, resetAllData, updateSetting } = useSettings()

  const cookies = config?.cookieConsent?.cookies ?? []
  const hasCookieConsent = cookies.length > 0
  const hasConsented = Boolean(settings?.cookieConsent?.consentedCookieHosts?.length)
  
  // Determine consent status
  const acceptedHosts = settings?.cookieConsent?.acceptedHosts ?? []
  const allHosts = cookies.map((c) => c.host)
  const acceptedAll = hasConsented && acceptedHosts.length === allHosts.length && allHosts.every(h => acceptedHosts.includes(h))
  const rejectedAll = hasConsented && acceptedHosts.length === 0

  const handleResetCookieConsent = () => {
    shellui.dialog({
      title: t('dataPrivacy.cookieConsent.dialog.title'),
      description: t('dataPrivacy.cookieConsent.dialog.description'),
      mode: "confirm",
      size: "sm",
      okLabel: t('dataPrivacy.cookieConsent.dialog.confirm'),
      cancelLabel: t('dataPrivacy.cookieConsent.dialog.cancel'),
      onOk: () => {
        updateSetting('cookieConsent', {
          acceptedHosts: [],
          consentedCookieHosts: [],
        })
      },
      onCancel: () => {
        // User cancelled, no action needed
      },
    })
  }

  const handleResetClick = () => {
    shellui.dialog({
      title: t('dataPrivacy.resetData.toast.title'),
      description: t('dataPrivacy.resetData.toast.description'),
      mode: "delete",
      size: "sm",
      okLabel: t('dataPrivacy.resetData.toast.confirm'),
      cancelLabel: t('dataPrivacy.resetData.toast.cancel'),
      onOk: () => {
        resetAllData()
        shellui.toast({
          title: t('dataPrivacy.resetData.toast.success.title'),
          description: t('dataPrivacy.resetData.toast.success.description'),
          type: "success",
        })
        shellui.navigate('/')
      },
      onCancel: () => {
        // User cancelled, no action needed
      },
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">{t('dataPrivacy.description')}</p>

      {hasCookieConsent && (
        <div className="space-y-3">
          <div className="space-y-0.5">
            <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
              {t('dataPrivacy.cookieConsent.title')}
            </label>
            <p className="text-sm text-muted-foreground">
              {!hasConsented
                ? t('dataPrivacy.cookieConsent.descriptionNotConsented')
                : acceptedAll
                  ? t('dataPrivacy.cookieConsent.statusAcceptedAll')
                  : rejectedAll
                    ? t('dataPrivacy.cookieConsent.statusRejectedAll')
                    : t('dataPrivacy.cookieConsent.descriptionConsented')}
            </p>
          </div>
          {hasConsented && (
            <div className="flex items-center gap-2 text-sm">
              <span className={acceptedAll ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                {acceptedAll ? "●" : "○"} {t('dataPrivacy.cookieConsent.labelAcceptedAll')}
              </span>
              <span className="text-muted-foreground/50">|</span>
              <span className={rejectedAll ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}>
                {rejectedAll ? "●" : "○"} {t('dataPrivacy.cookieConsent.labelRejectedAll')}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleResetCookieConsent}
            disabled={!hasConsented}
            className="w-full sm:w-auto"
          >
            {t('dataPrivacy.cookieConsent.button')}
          </Button>
        </div>
      )}
      
      <div className="space-y-2">
        <div className="space-y-0.5">
          <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
            {t('dataPrivacy.resetData.title')}
          </label>
          <p className="text-sm text-muted-foreground">
            {t('dataPrivacy.resetData.description')}
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={handleResetClick}
          className="w-full sm:w-auto"
        >
          {t('dataPrivacy.resetData.button')}
        </Button>
      </div>
    </div>
  )
}
