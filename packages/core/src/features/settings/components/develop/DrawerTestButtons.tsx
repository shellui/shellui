import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { shellui } from "@shellui/sdk"
import type { OpenDrawerOptions } from "@shellui/sdk"

const SETTINGS_DRAWER_URL = "/__settings"

export const DrawerTestButtons = () => {
  const { t } = useTranslation('settings')

  const openDrawer = (options: OpenDrawerOptions) => {
    shellui.openDrawer({ url: SETTINGS_DRAWER_URL, ...options })
  }

  return (
    <div>
      <h4 className="text-sm font-medium mb-2" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>{t('develop.testing.drawerTesting.title')}</h4>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => openDrawer({ position: 'right' })}
          variant="outline"
        >
          {t('develop.testing.drawerTesting.buttons.drawerRight')}
        </Button>
        <Button
          onClick={() => openDrawer({ position: 'left' })}
          variant="outline"
        >
          {t('develop.testing.drawerTesting.buttons.drawerLeft')}
        </Button>
        <Button
          onClick={() => openDrawer({ position: 'top' })}
          variant="outline"
        >
          {t('develop.testing.drawerTesting.buttons.drawerTop')}
        </Button>
        <Button
          onClick={() => openDrawer({ position: 'bottom' })}
          variant="outline"
        >
          {t('develop.testing.drawerTesting.buttons.drawerBottom')}
        </Button>
        <Button
          onClick={() => openDrawer({ position: 'right', size: '400px' })}
          variant="outline"
        >
          {t('develop.testing.drawerTesting.buttons.drawerRightNarrow')}
        </Button>
        <Button
          onClick={() => openDrawer({ position: 'bottom', size: '60vh' })}
          variant="outline"
        >
          {t('develop.testing.drawerTesting.buttons.drawerBottomHalf')}
        </Button>
        <Button
          onClick={() => shellui.closeDrawer()}
          variant="outline"
        >
          {t('develop.testing.drawerTesting.buttons.closeDrawer')}
        </Button>
      </div>
    </div>
  )
}
