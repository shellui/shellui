import { useTranslation } from "react-i18next"
import { Switch } from "@/components/ui/switch"
import { useConfig } from "@/features/config/useConfig"
import { closeSentry, initSentry } from "@/features/sentry/initSentry"
import { useSettings } from "../hooks/useSettings"

export const Advanced = () => {
  const { t } = useTranslation('settings')
  const { config } = useConfig()
  const { settings, updateSetting } = useSettings()
  const errorReportingConfigured = Boolean(config?.sentry?.dsn)

  const handleErrorReportingChange = (checked: boolean) => {
    updateSetting('errorReporting', { enabled: checked })
    if (checked) {
      initSentry()
    } else {
      closeSentry()
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t('advanced.description')}</p>

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
    </div>
  )
}
