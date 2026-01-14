import { Switch } from "@/components/ui/switch"
import { useSettings } from "../SettingsContext"

export const Advanced = () => {
  const { settings, updateSetting } = useSettings()

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">Advanced settings and configuration options.</p>
      
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <label htmlFor="developer-features" className="text-sm font-medium leading-none">
            Show features for developers
          </label>
          <p className="text-sm text-muted-foreground">
            Enable developer tools and settings in the settings menu.
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
