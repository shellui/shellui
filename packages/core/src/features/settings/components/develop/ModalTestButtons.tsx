import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { shellui } from "@shellui/sdk"

const SETTINGS_MODAL_URL = "/__settings"

export const ModalTestButtons = () => {
  const { t } = useTranslation('settings')

  return (
    <div>
      <h4 className="text-sm font-medium mb-2" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>{t('develop.testing.modalTesting.title')}</h4>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => shellui.openModal(SETTINGS_MODAL_URL)}
          variant="outline"
        >
          {t('develop.testing.modalTesting.buttons.openModal')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {t('develop.testing.modalTesting.description')}
      </p>
    </div>
  )
}
