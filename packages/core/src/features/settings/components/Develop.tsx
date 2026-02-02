import { useTranslation } from "react-i18next"
import { shellui } from "@shellui/sdk"
import { useSettings } from "../hooks/useSettings"
import { Switch } from "@/components/ui/switch"
import { Select } from "@/components/ui/select"
import { ToastTestButtons } from "./develop/ToastTestButtons"
import { DialogTestButtons } from "./develop/DialogTestButtons"
import { ModalTestButtons } from "./develop/ModalTestButtons"
import { DrawerTestButtons } from "./develop/DrawerTestButtons"

export const Develop = () => {
  const { t } = useTranslation('settings')
  const { settings, updateSetting } = useSettings()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>{t('develop.logging.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('develop.logging.description')}
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="log-shellsdk" className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                {t('develop.logging.shellsdk.label')}
              </label>
              <p className="text-sm text-muted-foreground">
                {t('develop.logging.shellsdk.description')}
              </p>
            </div>
            <Switch
              id="log-shellsdk"
              checked={settings.logging?.namespaces?.shellsdk || false}
              onCheckedChange={(checked) =>
                updateSetting('logging', {
                  namespaces: {
                    ...settings.logging?.namespaces,
                    shellsdk: checked
                  }
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="log-shellcore" className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
                {t('develop.logging.shellcore.label')}
              </label>
              <p className="text-sm text-muted-foreground">
                {t('develop.logging.shellcore.description')}
              </p>
            </div>
            <Switch
              id="log-shellcore"
              checked={settings.logging?.namespaces?.shellcore || false}
              onCheckedChange={(checked) =>
                updateSetting('logging', {
                  namespaces: {
                    ...settings.logging?.namespaces,
                    shellcore: checked
                  }
                })
              }
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>{t('develop.navigation.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('develop.navigation.description')}
        </p>
        {settings.navigation?.items?.length ? (
          <div className="space-y-2">
            <label htmlFor="develop-nav-select" className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
              {t('develop.navigation.selectLabel')}
            </label>
            <Select
              id="develop-nav-select"
              defaultValue=""
              onChange={(e) => {
                const path = e.target.value
                if (path) {
                  shellui.sendMessageToParent({
                    type: 'SHELLUI_NAVIGATE',
                    payload: { url: path.startsWith('/') ? path : `/${path}` },
                  })
                }
              }}
            >
              <option value="">{t('develop.navigation.placeholder')}</option>
              {settings.navigation.items
                .filter((item, index, self) => index === self.findIndex((i) => i.path === item.path))
                .map((item) => (
                  <option key={item.path} value={`/${item.path}`}>
                    {item.label ?? item.path}
                  </option>
                ))}
            </Select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('develop.navigation.empty')}</p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>{t('develop.testing.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('develop.testing.description')}
        </p>

        <div className="space-y-4">
          <ToastTestButtons />
          <DialogTestButtons />
          <ModalTestButtons />
          <DrawerTestButtons />
        </div>
      </div>
    </div>
  )
}
