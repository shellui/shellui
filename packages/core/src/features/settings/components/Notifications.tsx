import { useTranslation } from "react-i18next"

export const Notifications = () => {
  const { t } = useTranslation('settings')
  
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t('notifications.description')}</p>
    </div>
  )
}
