import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { useConfig } from '../../config/useConfig';
import { Button } from '../../../components/ui/button';
import { ButtonGroup } from '../../../components/ui/button-group';
import { cn } from '../../../lib/utils';
import { useEffect, useState, useMemo } from 'react';
import {
  getAllThemes,
  setAvailableThemes,
  defaultTheme,
  type ThemeDefinition,
} from '../../theme/themes';
import type { SettingsAvailableTheme } from '@shellui/sdk';

const SunIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle
      cx="12"
      cy="12"
      r="4"
    />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const MonitorIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect
      width="20"
      height="14"
      x="2"
      y="3"
      rx="2"
    />
    <line
      x1="8"
      x2="16"
      y1="21"
      y2="21"
    />
    <line
      x1="12"
      x2="12"
      y1="17"
      y2="21"
    />
  </svg>
);

/** Theme-like shape used for preview (ThemeDefinition or SettingsAvailableTheme). */
type ThemePreviewItem = Pick<
  ThemeDefinition | SettingsAvailableTheme,
  'name' | 'displayName' | 'colors' | 'fontFamily' | 'letterSpacing' | 'textShadow'
> & { description?: string; recommended?: boolean };

function MiniSwatch({ colors }: { colors: ThemePreviewItem['colors']['light'] }) {
  return (
    <div
      className="flex flex-1 flex-col gap-1 rounded-md border p-1.5"
      style={{ backgroundColor: colors.background, borderColor: colors.border }}
    >
      <div
        className="h-3 rounded-sm"
        style={{ backgroundColor: colors.primary }}
      />
      <div className="flex gap-0.5">
        <div
          className="h-2 flex-1 rounded-sm"
          style={{ backgroundColor: colors.secondary }}
        />
        <div
          className="h-2 flex-1 rounded-sm"
          style={{ backgroundColor: colors.accent }}
        />
        <div
          className="h-2 flex-1 rounded-sm"
          style={{ backgroundColor: colors.muted }}
        />
      </div>
    </div>
  );
}

const ThemePreview = ({
  theme,
  isSelected,
  isDark,
  layout,
  recommendedLabel,
}: {
  theme: ThemePreviewItem;
  isSelected: boolean;
  isDark: boolean;
  layout: 'single' | 'few' | 'many';
  recommendedLabel: string;
}) => {
  const colors = isDark ? theme.colors.dark : theme.colors.light;

  if (layout === 'many') {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border-2 transition-all',
          isSelected
            ? 'border-primary shadow-md'
            : 'border-border hover:border-muted-foreground/40',
        )}
      >
        <div className="flex gap-1 p-2">
          <MiniSwatch colors={theme.colors.light} />
          <MiniSwatch colors={theme.colors.dark} />
        </div>
        <div
          className="border-t px-2 py-1.5"
          style={{
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
          }}
        >
          <p
            className="truncate text-xs font-medium"
            style={
              theme.fontFamily
                ? {
                    fontFamily: theme.fontFamily,
                    letterSpacing: theme.letterSpacing || 'normal',
                    textShadow: theme.textShadow || 'none',
                  }
                : undefined
            }
          >
            {theme.displayName}
          </p>
          {theme.recommended ? (
            <p
              className="text-[10px] opacity-70"
              style={{ color: colors.mutedForeground }}
            >
              {recommendedLabel}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border-2 transition-all',
        isSelected ? 'border-primary shadow-lg' : 'border-border',
        layout === 'single' && 'max-w-sm',
      )}
      style={{ backgroundColor: colors.background }}
    >
      <div className={cn('space-y-2', layout === 'single' ? 'p-4' : 'p-3')}>
        <div
          className={cn('rounded-md', layout === 'single' ? 'h-10' : 'h-8')}
          style={{ backgroundColor: colors.primary }}
        />
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
      <div
        className="px-2 py-1.5"
        style={{ backgroundColor: colors.background, color: colors.foreground }}
      >
        <p
          className={cn('font-medium text-center', layout === 'single' ? 'text-sm' : 'text-xs')}
          style={
            theme.fontFamily
              ? {
                  fontFamily: theme.fontFamily,
                  letterSpacing: theme.letterSpacing || 'normal',
                  textShadow: theme.textShadow || 'none',
                }
              : undefined
          }
        >
          {theme.displayName}
        </p>
        {layout === 'single' && theme.description ? (
          <p
            className="mt-0.5 text-center text-xs opacity-70"
            style={{ color: colors.mutedForeground }}
          >
            {theme.description}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export const Appearance = () => {
  const { t } = useTranslation('settings');
  const { settings, updateSetting } = useSettings();
  const { config } = useConfig();
  const currentTheme = settings.appearance?.colorScheme ?? 'system';
  const currentThemeName = settings.appearance?.name ?? 'default';

  const [localThemes, setLocalThemes] = useState<ThemeDefinition[]>([]);

  useEffect(() => {
    const available: ThemeDefinition[] =
      config?.themes && Array.isArray(config.themes) && config.themes.length > 0
        ? (config.themes as ThemeDefinition[])
        : [defaultTheme];
    setAvailableThemes(available);
    setLocalThemes(getAllThemes());
  }, [config]);

  const availableThemes = useMemo((): ThemePreviewItem[] => {
    const fromSettings = settings.appearance?.availableThemes;
    if (fromSettings?.length) return fromSettings;
    return localThemes;
  }, [settings.appearance?.availableThemes, localThemes]);

  const sortedThemes = useMemo(() => {
    return [...availableThemes].sort((a, b) => {
      const ar = 'recommended' in a && a.recommended ? 0 : 1;
      const br = 'recommended' in b && b.recommended ? 0 : 1;
      if (ar !== br) return ar - br;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [availableThemes]);

  const layout: 'single' | 'few' | 'many' =
    sortedThemes.length <= 1 ? 'single' : sortedThemes.length <= 3 ? 'few' : 'many';

  const [isDarkForPreview, setIsDarkForPreview] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      currentTheme === 'dark' ||
      (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updatePreview = () => {
      setIsDarkForPreview(
        currentTheme === 'dark' ||
          (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
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
  ];

  const gridClass =
    layout === 'single'
      ? 'grid grid-cols-1 max-w-sm'
      : layout === 'few'
        ? 'grid grid-cols-1 sm:grid-cols-3 gap-4'
        : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="space-y-0.5">
          <label
            className="text-sm font-medium leading-none"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('appearance.mode')}
          </label>
          <p className="text-sm text-muted-foreground">{t('appearance.modeDescription')}</p>
        </div>
        <div className="mt-2">
          <ButtonGroup>
            {modeThemes.map((theme) => {
              const Icon = theme.icon;
              const isSelected = currentTheme === theme.value;
              return (
                <Button
                  key={theme.value}
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => {
                    updateSetting('appearance', { colorScheme: theme.value });
                  }}
                  className={cn(
                    'h-10 px-4 transition-all flex items-center gap-2 cursor-pointer',
                    isSelected && ['font-semibold'],
                    !isSelected && ['bg-background hover:bg-accent/50', 'text-muted-foreground'],
                  )}
                  aria-label={theme.label}
                  title={theme.label}
                >
                  <Icon />
                  <span className="text-sm font-medium">{theme.label}</span>
                </Button>
              );
            })}
          </ButtonGroup>
        </div>
      </div>

      <div className="space-y-2">
        <div className="space-y-0.5">
          <label
            className="text-sm font-medium leading-none"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('appearance.colorTheme')}
          </label>
          <p className="text-sm text-muted-foreground">
            {layout === 'single'
              ? t('appearance.colorThemeDescriptionSingle')
              : t('appearance.colorThemeDescription')}
          </p>
        </div>
        <div className={cn('mt-2', gridClass)}>
          {sortedThemes.map((theme) => {
            const isSelected = currentThemeName === theme.name;
            return (
              <button
                key={theme.name}
                type="button"
                onClick={() => {
                  updateSetting('appearance', { name: theme.name });
                }}
                className={cn(
                  'text-left transition-all cursor-pointer rounded-lg',
                  isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                )}
                aria-label={theme.displayName}
                aria-pressed={isSelected}
              >
                <ThemePreview
                  theme={theme}
                  isSelected={isSelected}
                  isDark={isDarkForPreview}
                  layout={layout}
                  recommendedLabel={t('appearance.recommended')}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
