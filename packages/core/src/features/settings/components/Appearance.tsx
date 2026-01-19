import { useSettings } from "../SettingsContext"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { cn } from "@/lib/utils"

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
)

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
)

const MonitorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </svg>
)

export const Appearance = () => {
  const { settings, updateSetting } = useSettings()
  const currentTheme = settings.appearance?.theme || 'system'

  const themes = [
    { value: 'light' as const, label: 'Light', icon: SunIcon },
    { value: 'dark' as const, label: 'Dark', icon: MoonIcon },
    { value: 'system' as const, label: 'System', icon: MonitorIcon },
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">
          Theme
        </label>
        <p className="text-sm text-muted-foreground">
          Choose your preferred color scheme (current: {settings.appearance?.theme})
        </p>
        <ButtonGroup>
          {themes.map((theme) => {
            const Icon = theme.icon
            const isSelected = currentTheme === theme.value
            return (
              <Button
                key={theme.value}
                variant={isSelected ? "default" : "outline"}
                onClick={() => {
                  updateSetting('appearance', { theme: theme.value })
                }}
                className={cn(
                  "h-10 px-4 transition-all flex items-center gap-2",
                  isSelected && [
                    "bg-secondary text-secondary-foreground",
                    "shadow-md",
                    "font-semibold",
                    "border-2 border-primary"
                  ],
                  !isSelected && [
                    "bg-background hover:bg-accent/50",
                    "text-muted-foreground"
                  ]
                )}
                aria-label={theme.label}
                title={theme.label}
              >
                <Icon />
                <span className="text-sm font-medium">{theme.label}</span>
              </Button>
            )
          })}
        </ButtonGroup>
      </div>
    </div>
  )
}
