import { useTranslation } from "react-i18next"
import { useSettings } from "../hooks/useSettings"
import { useConfig } from "@/features/config/useConfig"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { getAllThemes, registerTheme, type ThemeDefinition } from "@/features/theme/themes"

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

// Theme color preview component
const ThemePreview = ({ theme, isSelected, isDark }: { theme: ThemeDefinition; isSelected: boolean; isDark: boolean }) => {
  const colors = isDark ? theme.colors.dark : theme.colors.light;
  
  return (
    <div className={cn(
      "relative overflow-hidden rounded-lg border-2 transition-all",
      isSelected ? "border-primary shadow-lg" : "border-border"
    )}
    style={{ backgroundColor: colors.background }}>
      <div className="p-3 space-y-2">
        {/* Primary color */}
        <div 
          className="h-8 rounded-md"
          style={{ backgroundColor: colors.primary }}
        />
        {/* Secondary colors */}
        <div className="flex gap-1">
          <div 
            className="h-6 flex-1 rounded"
            style={{ backgroundColor: colors.background }}
          />
          <div 
            className="h-6 flex-1 rounded"
            style={{ backgroundColor: colors.secondary }}
          />
          <div 
            className="h-6 flex-1 rounded"
            style={{ backgroundColor: colors.accent }}
          />
        </div>
        {/* Accent colors */}
        <div className="flex gap-1">
          <div 
            className="h-4 flex-1 rounded"
            style={{ backgroundColor: colors.muted }}
          />
          <div 
            className="h-4 flex-1 rounded"
            style={{ backgroundColor: colors.border }}
          />
        </div>
      </div>
      {/* Theme name overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-sm px-2 py-1" style={{ backgroundColor: colors.background }}>
        <p 
          className="text-xs font-medium text-center"
          style={theme.fontFamily ? { 
            fontFamily: theme.fontFamily,
            letterSpacing: theme.letterSpacing || 'normal',
            textShadow: theme.textShadow || 'none'
          } : {}}
        >
          {theme.displayName}
        </p>
      </div>
    </div>
  );
};

export const Appearance = () => {
  const { t } = useTranslation('settings')
  const { settings, updateSetting } = useSettings()
  const { config } = useConfig()
  const currentTheme = settings.appearance?.theme || 'system'
  const currentThemeName = settings.appearance?.themeName || 'default'
  
  const [availableThemes, setAvailableThemes] = useState<ThemeDefinition[]>([])

  // Register custom themes from config and get all themes
  useEffect(() => {
    if (config?.themes) {
      config.themes.forEach((themeDef: ThemeDefinition) => {
        registerTheme(themeDef);
      });
    }
    setAvailableThemes(getAllThemes());
  }, [config])

  // Determine if we're in dark mode for preview
  const [isDarkForPreview, setIsDarkForPreview] = useState(() => {
    if (typeof window === 'undefined') return false;
    return currentTheme === 'dark' || 
      (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Update preview mode when theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const updatePreview = () => {
      setIsDarkForPreview(
        currentTheme === 'dark' || 
        (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    };

    updatePreview();

    if (currentTheme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updatePreview();
      
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, [currentTheme]);

  const modeThemes = [
    { value: 'light' as const, label: t('appearance.themes.light'), icon: SunIcon },
    { value: 'dark' as const, label: t('appearance.themes.dark'), icon: MoonIcon },
    { value: 'system' as const, label: t('appearance.themes.system'), icon: MonitorIcon },
  ]

  return (
    <div className="space-y-6">
      {/* Theme Mode Selection (Light/Dark/System) */}
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
          {t('appearance.mode')}
        </label>
        <p className="text-sm text-muted-foreground">
          {t('appearance.modeDescription', { mode: currentTheme })}
        </p>
        <ButtonGroup>
          {modeThemes.map((theme) => {
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
                  "h-10 px-4 transition-all flex items-center gap-2 cursor-pointer",
                  isSelected && [
                    "shadow-md",
                    "font-semibold"
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

      {/* Theme Selection (Color Scheme) */}
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
          {t('appearance.colorTheme')}
        </label>
        <p className="text-sm text-muted-foreground">
          {t('appearance.colorThemeDescription')}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {availableThemes.map((theme) => {
            const isSelected = currentThemeName === theme.name
            return (
              <button
                key={theme.name}
                onClick={() => {
                  updateSetting('appearance', { themeName: theme.name })
                }}
                className={cn(
                  "text-left transition-all cursor-pointer",
                  isSelected && "ring-2 ring-primary ring-offset-2 rounded-lg"
                )}
                aria-label={theme.displayName}
              >
                <ThemePreview 
                  theme={theme} 
                  isSelected={isSelected}
                  isDark={isDarkForPreview}
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
