import { useTranslation } from "react-i18next"
import { useSettings } from "../SettingsContext"
import { Button } from "@/components/ui/button"
import { shellui } from "@shellui/sdk"

export const DataPrivacy = () => {
  const { t } = useTranslation('settings')
  const { resetAllData } = useSettings()

  const handleResetClick = () => {
    shellui.dialog({
      title: t('dataPrivacy.resetData.toast.title'),
      description: t('dataPrivacy.resetData.toast.description'),
      mode: "delete",
      okLabel: t('dataPrivacy.resetData.toast.confirm'),
      cancelLabel: t('dataPrivacy.resetData.toast.cancel'),
      onOk: () => {
        resetAllData()
        shellui.toast({
          title: t('dataPrivacy.resetData.toast.success.title'),
          description: t('dataPrivacy.resetData.toast.success.description'),
          type: "success",
        })
      },
      onCancel: () => {
        // User cancelled, no action needed
      },
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t('dataPrivacy.description')}</p>
      
      <div className="space-y-2">
        <div className="space-y-0.5">
          <label className="text-sm font-medium leading-none">
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
