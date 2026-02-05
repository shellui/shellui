import { useTranslation } from "react-i18next"
import { Switch } from "@/components/ui/switch"
import { useConfig } from "@/features/config/useConfig"
import { closeSentry, initSentry } from "@/features/sentry/initSentry"
import { useSettings } from "../hooks/useSettings"
import { Button } from "@/components/ui/button"
import { shellui } from "@shellui/sdk"

export const Advanced = () => {
  const { t } = useTranslation('settings')
  const { config } = useConfig()
  const { settings, updateSetting, resetAllData } = useSettings()
  const errorReportingConfigured = Boolean(config?.sentry?.dsn)

  const handleErrorReportingChange = (checked: boolean) => {
    updateSetting('errorReporting', { enabled: checked })
    if (checked) {
      initSentry()
    } else {
      closeSentry()
    }
  }

  const handleResetClick = () => {
    shellui.dialog({
      title: t('advanced.dangerZone.reset.toast.title'),
      description: t('advanced.dangerZone.reset.toast.description'),
      mode: "delete",
      size: "sm",
      okLabel: t('advanced.dangerZone.reset.toast.confirm'),
      cancelLabel: t('advanced.dangerZone.reset.toast.cancel'),
      onOk: () => {
        resetAllData()
        shellui.toast({
          title: t('advanced.dangerZone.reset.toast.success.title'),
          description: t('advanced.dangerZone.reset.toast.success.description'),
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
            {t('advanced.errorReporting.label')}
          </span>
          <p className="text-sm text-muted-foreground">
            {errorReportingConfigured
              ? t('advanced.errorReporting.statusConfigured')
              : t('advanced.errorReporting.statusNotConfigured')}
          </p>
        </div>
        {errorReportingConfigured && (
          <Switch
            id="error-reporting"
            checked={settings.errorReporting.enabled}
            onCheckedChange={handleErrorReportingChange}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <label htmlFor="developer-features" className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
            {t('advanced.developerFeatures.label')}
          </label>
          <p className="text-sm text-muted-foreground">
            {t('advanced.developerFeatures.description')}
          </p>
        </div>
        <Switch
          id="developer-features"
          checked={settings.developerFeatures.enabled}
          onCheckedChange={(checked) => updateSetting('developerFeatures', { enabled: checked })}
        />
      </div>

      <div className="border-t pt-6 mt-6">
        <div className="space-y-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold leading-none text-destructive" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
              {t('advanced.dangerZone.title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('advanced.dangerZone.description')}
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="space-y-0.5">
              <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                {t('advanced.dangerZone.reset.title')}
              </label>
              <p className="text-sm text-muted-foreground">
                {t('advanced.dangerZone.reset.warning')}
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleResetClick}
              className="w-full sm:w-auto"
            >
              {t('advanced.dangerZone.reset.button')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
