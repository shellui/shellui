import { useTranslation } from "react-i18next"
import { useSettings } from "../SettingsContext"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { shellui } from "@shellui/sdk"

export const Develop = () => {
  const { t } = useTranslation('settings')
  const { settings, updateSetting } = useSettings()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t('develop.logging.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('develop.logging.description')}
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="log-shellsdk" className="text-sm font-medium leading-none">
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
              <label htmlFor="log-shellcore" className="text-sm font-medium leading-none">
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
        <h3 className="text-lg font-semibold mb-2">{t('develop.testing.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('develop.testing.description')}
        </p>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">{t('develop.testing.toastNotifications.title')}</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  shellui.toast({
                    title: t('develop.testing.toastNotifications.messages.success.title'),
                    description: t('develop.testing.toastNotifications.messages.success.description'),
                    type: "success",
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.toastNotifications.buttons.success')}
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: t('develop.testing.toastNotifications.messages.error.title'),
                    description: t('develop.testing.toastNotifications.messages.error.description'),
                    type: "error",
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.toastNotifications.buttons.error')}
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: t('develop.testing.toastNotifications.messages.warning.title'),
                    description: t('develop.testing.toastNotifications.messages.warning.description'),
                    type: "warning",
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.toastNotifications.buttons.warning')}
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: t('develop.testing.toastNotifications.messages.info.title'),
                    description: t('develop.testing.toastNotifications.messages.info.description'),
                    type: "info",
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.toastNotifications.buttons.info')}
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: t('develop.testing.toastNotifications.messages.default.title'),
                    description: t('develop.testing.toastNotifications.messages.default.description'),
                    type: "default",
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.toastNotifications.buttons.default')}
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: t('develop.testing.toastNotifications.messages.loading.title'),
                    description: t('develop.testing.toastNotifications.messages.loading.description'),
                    type: "loading",
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.toastNotifications.buttons.loading')}
              </Button>
              <Button
                onClick={() => {
                  const toastId = shellui.toast({
                    title: t('develop.testing.toastNotifications.messages.processing.title'),
                    description: t('develop.testing.toastNotifications.messages.processing.description'),
                    type: "loading",
                  });

                  // Simulate async operation and update toast
                  if (typeof toastId === 'string') {
                    setTimeout(() => {
                      shellui.toast({
                        id: toastId,
                        type: "success",
                        title: t('develop.testing.toastNotifications.messages.uploadComplete.title'),
                        description: t('develop.testing.toastNotifications.messages.uploadComplete.description'),
                      });
                    }, 2000);
                  }
                }}
                variant="outline"
              >
                {t('develop.testing.toastNotifications.buttons.loadingSuccess')}
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: t('develop.testing.toastNotifications.messages.withAction.title'),
                    description: t('develop.testing.toastNotifications.messages.withAction.description'),
                    type: "success",
                    action: {
                      label: t('develop.testing.toastNotifications.messages.actionLabels.undo'),
                      onClick: () => {
                        shellui.toast({
                          title: t('develop.testing.toastNotifications.messages.undone.title'),
                          description: t('develop.testing.toastNotifications.messages.undone.description'),
                          type: "info",
                        });
                      },
                    },
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.toastNotifications.buttons.withAction')}
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: t('develop.testing.toastNotifications.messages.withAction.title'),
                    description: t('develop.testing.toastNotifications.messages.withAction.description'),
                    type: "success",
                    action: {
                      label: t('develop.testing.toastNotifications.messages.actionLabels.undo'),
                      onClick: () => {
                        shellui.toast({
                          title: t('develop.testing.toastNotifications.messages.undone.title'),
                          description: t('develop.testing.toastNotifications.messages.undone.description'),
                          type: "info",
                        });
                      },
                    },
                    cancel: {
                      label: t('develop.testing.toastNotifications.messages.actionLabels.cancel'),
                      onClick: () => {
                        shellui.toast({
                          title: t('develop.testing.toastNotifications.messages.cancelled.title'),
                          description: t('develop.testing.toastNotifications.messages.cancelled.description'),
                          type: "info",
                        });
                      },
                    },
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.toastNotifications.buttons.withActionAndCancel')}
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: t('develop.testing.toastNotifications.messages.persistent.title'),
                    description: t('develop.testing.toastNotifications.messages.persistent.description'),
                    type: "info",
                    duration: 10000,
                  });
                }}
                variant="outline"
              >
                {t('develop.testing.toastNotifications.buttons.longDuration')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
