import { useTranslation } from "react-i18next"
import { useSettings } from "../SettingsContext"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { shellui } from "@shellui/sdk"
import { ToastTestButtons } from "./ToastTestButtons"

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
          <ToastTestButtons />
          
          <div>
            <h4 className="text-sm font-medium mb-2">Dialog Testing</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  shellui.dialog({
                    title: "Simple OK Dialog",
                    description: "This is a simple dialog with just an OK button.",
                    mode: "ok",
                    onOk: () => {
                      shellui.toast({
                        title: "OK clicked",
                        type: "success",
                      });
                    },
                  });
                }}
                variant="outline"
              >
                OK Dialog
              </Button>
              <Button
                onClick={() => {
                  shellui.dialog({
                    title: "OK Cancel Dialog",
                    description: "This dialog has both OK and Cancel buttons.",
                    mode: "okCancel",
                    onOk: () => {
                      shellui.toast({
                        title: "OK clicked",
                        type: "success",
                      });
                    },
                    onCancel: () => {
                      shellui.toast({
                        title: "Cancel clicked",
                        type: "info",
                      });
                    },
                  });
                }}
                variant="outline"
              >
                OK Cancel Dialog
              </Button>
              <Button
                onClick={() => {
                  shellui.dialog({
                    title: "Delete Confirmation",
                    description: "Are you sure you want to delete this item? This action cannot be undone.",
                    mode: "delete",
                    okLabel: "Delete",
                    cancelLabel: "Cancel",
                    onOk: () => {
                      shellui.toast({
                        title: "Item deleted",
                        type: "success",
                      });
                    },
                    onCancel: () => {
                      shellui.toast({
                        title: "Deletion cancelled",
                        type: "info",
                      });
                    },
                  });
                }}
                variant="outline"
              >
                Delete Dialog
              </Button>
              <Button
                onClick={() => {
                  shellui.dialog({
                    title: "Confirm Action",
                    description: "Do you want to proceed with this action?",
                    mode: "confirm",
                    okLabel: "Confirm",
                    cancelLabel: "Cancel",
                    onOk: () => {
                      shellui.toast({
                        title: "Action confirmed",
                        type: "success",
                      });
                    },
                    onCancel: () => {
                      shellui.toast({
                        title: "Action cancelled",
                        type: "info",
                      });
                    },
                  });
                }}
                variant="outline"
              >
                Confirm Dialog
              </Button>
              <Button
                onClick={() => {
                  shellui.dialog({
                    title: "Only Cancel Dialog",
                    description: "This dialog only has a Cancel button.",
                    mode: "onlyCancel",
                    cancelLabel: "Close",
                    onCancel: () => {
                      shellui.toast({
                        title: "Dialog closed",
                        type: "info",
                      });
                    },
                  });
                }}
                variant="outline"
              >
                Only Cancel Dialog
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
