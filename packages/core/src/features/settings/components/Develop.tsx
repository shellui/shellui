import { useTranslation } from "react-i18next"
import { useSettings } from "../SettingsContext"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { shellui } from "@shellui/sdk"
import { ToastTestButtons } from "./develop/ToastTestButtons"

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
        <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>{t('develop.testing.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('develop.testing.description')}
        </p>

        <div className="space-y-4">
          <ToastTestButtons />
          
          <div>
            <h4 className="text-sm font-medium mb-2" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>{t('develop.testing.dialogTesting.title')}</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  shellui.dialog({
                    title: t('develop.testing.dialogTesting.dialogs.ok.title'),
                    description: t('develop.testing.dialogTesting.dialogs.ok.description'),
                    mode: "ok",
                    onOk: () => {
                      shellui.toast({
                        title: t('develop.testing.dialogTesting.toasts.okClicked'),
                        type: "success",
                      });
                    },
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.dialogTesting.buttons.okDialog')}
              </Button>
              <Button
                onClick={() => {
                  shellui.dialog({
                    title: t('develop.testing.dialogTesting.dialogs.okCancel.title'),
                    description: t('develop.testing.dialogTesting.dialogs.okCancel.description'),
                    mode: "okCancel",
                    onOk: () => {
                      shellui.toast({
                        title: t('develop.testing.dialogTesting.toasts.okClicked'),
                        type: "success",
                      });
                    },
                    onCancel: () => {
                      shellui.toast({
                        title: t('develop.testing.dialogTesting.toasts.cancelClicked'),
                        type: "info",
                      });
                    },
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.dialogTesting.buttons.okCancelDialog')}
              </Button>
              <Button
                onClick={() => {
                  shellui.dialog({
                    title: t('develop.testing.dialogTesting.dialogs.delete.title'),
                    description: t('develop.testing.dialogTesting.dialogs.delete.description'),
                    mode: "delete",
                    okLabel: t('develop.testing.dialogTesting.dialogs.delete.okLabel'),
                    cancelLabel: t('develop.testing.dialogTesting.dialogs.delete.cancelLabel'),
                    onOk: () => {
                      shellui.toast({
                        title: t('develop.testing.dialogTesting.toasts.itemDeleted'),
                        type: "success",
                      });
                    },
                    onCancel: () => {
                      shellui.toast({
                        title: t('develop.testing.dialogTesting.toasts.deletionCancelled'),
                        type: "info",
                      });
                    },
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.dialogTesting.buttons.deleteDialog')}
              </Button>
              <Button
                onClick={() => {
                  shellui.dialog({
                    title: t('develop.testing.dialogTesting.dialogs.confirm.title'),
                    description: t('develop.testing.dialogTesting.dialogs.confirm.description'),
                    mode: "confirm",
                    okLabel: t('develop.testing.dialogTesting.dialogs.confirm.okLabel'),
                    cancelLabel: t('develop.testing.dialogTesting.dialogs.confirm.cancelLabel'),
                    onOk: () => {
                      shellui.toast({
                        title: t('develop.testing.dialogTesting.toasts.actionConfirmed'),
                        type: "success",
                      });
                    },
                    onCancel: () => {
                      shellui.toast({
                        title: t('develop.testing.dialogTesting.toasts.actionCancelled'),
                        type: "info",
                      });
                    },
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.dialogTesting.buttons.confirmDialog')}
              </Button>
              <Button
                onClick={() => {
                  shellui.dialog({
                    title: t('develop.testing.dialogTesting.dialogs.onlyCancel.title'),
                    description: t('develop.testing.dialogTesting.dialogs.onlyCancel.description'),
                    mode: "onlyCancel",
                    cancelLabel: t('develop.testing.dialogTesting.dialogs.onlyCancel.cancelLabel'),
                    onCancel: () => {
                      shellui.toast({
                        title: t('develop.testing.dialogTesting.toasts.dialogClosed'),
                        type: "info",
                      });
                    },
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.dialogTesting.buttons.onlyCancelDialog')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
