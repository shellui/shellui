import { useSettings } from "../SettingsContext"
import { Switch } from "@/components/ui/switch"

export const Develop = () => {
  const { settings, updateSetting } = useSettings()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Logging</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enable or disable logging for specific namespaces. This helps you control which parts of ShellUI output debug information.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="log-shellsdk" className="text-sm font-medium leading-none">
                Show ShellSDK logs
              </label>
              <p className="text-sm text-muted-foreground">
                Enable logging for ShellUI SDK operations
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
                Show ShellCore logs
              </label>
              <p className="text-sm text-muted-foreground">
                Enable logging for ShellUI Core operations
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
    </div>
  )
}
