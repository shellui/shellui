import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { useConfig } from '../../config/useConfig';
import { Button } from '../../../components/ui/button';
import { ButtonGroup } from '../../../components/ui/button-group';
import { cn } from '../../../lib/utils';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  getAllThemes,
  setAvailableThemes,
  defaultTheme,
  type ThemeDefinition,
} from '../../theme/themes';
import { waitForThemeSwitchIdle } from '../../theme/safeApplyTheme';
import type { SettingsAvailableTheme } from '@shellui/sdk';

const ThemeSwitchSpinner = ({ className }: { className?: string }) => (
  <svg
    data-theme-switch-spinner=""
    className={cn('animate-spin', className)}
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

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

function previewRadius(radius: string | undefined, inset = 0): string {
  const base = radius?.trim() || '0.5rem';
  if (inset <= 0) return base;
  return `max(0px, calc(${base} - ${inset}px))`;
}

function MiniSwatch({ colors }: { colors: ThemePreviewItem['colors']['light'] }) {
  const radius = colors.radius;
  return (
    <div
      className="flex flex-1 flex-col gap-1 border p-1.5"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderRadius: previewRadius(radius, 2),
      }}
    >
      <div
        className="h-3"
        style={{ backgroundColor: colors.primary, borderRadius: previewRadius(radius, 4) }}
      />
      <div className="flex gap-0.5">
        <div
          className="h-2 flex-1"
          style={{ backgroundColor: colors.secondary, borderRadius: previewRadius(radius, 4) }}
        />
        <div
          className="h-2 flex-1"
          style={{ backgroundColor: colors.accent, borderRadius: previewRadius(radius, 4) }}
        />
        <div
          className="h-2 flex-1"
          style={{ backgroundColor: colors.muted, borderRadius: previewRadius(radius, 4) }}
        />
      </div>
    </div>
  );
}

const ThemePreview = ({
  theme,
  isSelected,
  isDark,
  isPending = false,
  layout,
  recommendedLabel,
}: {
  theme: ThemePreviewItem;
  isSelected: boolean;
  isDark: boolean;
  isPending?: boolean;
  layout: 'single' | 'few' | 'many';
  recommendedLabel: string;
}) => {
  const colors = isDark ? theme.colors.dark : theme.colors.light;
  const radius = colors.radius;

  const pendingOverlay = (
    <div
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center bg-background/55 backdrop-blur-[1px]',
        'transition-opacity duration-300 ease-out',
        isPending ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      style={{ borderRadius: previewRadius(radius) }}
      aria-hidden={!isPending}
    >
      <ThemeSwitchSpinner className="size-5 text-primary" />
      {isPending ? <span className="sr-only">Applying theme</span> : null}
    </div>
  );

  if (layout === 'many') {
    return (
      <div
        className={cn(
          'relative overflow-hidden border-2',
          isSelected
            ? 'border-primary shadow-md'
            : 'border-border hover:border-muted-foreground/40',
        )}
        style={{ borderRadius: previewRadius(radius) }}
      >
        {pendingOverlay}
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
        'relative overflow-hidden border-2',
        isSelected ? 'border-primary shadow-lg' : 'border-border',
        layout === 'single' && 'max-w-sm',
      )}
      style={{ backgroundColor: colors.background, borderRadius: previewRadius(radius) }}
    >
      {pendingOverlay}
      <div className={cn('space-y-2', layout === 'single' ? 'p-4' : 'p-3')}>
        <div
          className={layout === 'single' ? 'h-10' : 'h-8'}
          style={{ backgroundColor: colors.primary, borderRadius: previewRadius(radius, 2) }}
        />
        <div className="flex gap-1">
          <div
            className="h-6 flex-1"
            style={{
              backgroundColor: colors.background,
              borderRadius: previewRadius(radius, 4),
            }}
          />
          <div
            className="h-6 flex-1"
            style={{
              backgroundColor: colors.secondary,
              borderRadius: previewRadius(radius, 4),
            }}
          />
          <div
            className="h-6 flex-1"
            style={{ backgroundColor: colors.accent, borderRadius: previewRadius(radius, 4) }}
          />
        </div>
        <div className="flex gap-1">
          <div
            className="h-4 flex-1"
            style={{ backgroundColor: colors.muted, borderRadius: previewRadius(radius, 4) }}
          />
          <div
            className="h-4 flex-1"
            style={{ backgroundColor: colors.border, borderRadius: previewRadius(radius, 4) }}
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
  const [pendingThemeName, setPendingThemeName] = useState<string | null>(null);
  const [pendingColorScheme, setPendingColorScheme] = useState<'light' | 'dark' | 'system' | null>(
    null,
  );
  // Ref lock so rapid clicks in the same render cannot all pass the busy check.
  const switchLockRef = useRef(false);
  const themeSwitchBusy = pendingThemeName !== null || pendingColorScheme !== null;
  const displayedColorScheme = pendingColorScheme ?? currentTheme;

  const runAppearanceSwitch = useCallback(async (work: () => void) => {
    try {
      work();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await waitForThemeSwitchIdle();
      // Cover trailing iframe settings echo so the next click won't collide.
      await new Promise((resolve) => setTimeout(resolve, 220));
      return true;
    } catch {
      return false;
    }
  }, []);

  const selectTheme = useCallback(
    async (themeName: string) => {
      if (switchLockRef.current) return;
      if (themeName === currentThemeName) return;
      switchLockRef.current = true;
      setPendingThemeName(themeName);
      try {
        await runAppearanceSwitch(() => {
          updateSetting('appearance', { name: themeName });
        });
      } finally {
        switchLockRef.current = false;
        setPendingThemeName(null);
      }
    },
    [currentThemeName, updateSetting, runAppearanceSwitch],
  );

  const selectColorScheme = useCallback(
    async (colorScheme: 'light' | 'dark' | 'system') => {
      if (switchLockRef.current) return;
      if (colorScheme === currentTheme) return;
      switchLockRef.current = true;
      setPendingColorScheme(colorScheme);
      try {
        await runAppearanceSwitch(() => {
          updateSetting('appearance', { colorScheme });
        });
      } finally {
        switchLockRef.current = false;
        setPendingColorScheme(null);
      }
    },
    [currentTheme, updateSetting, runAppearanceSwitch],
  );

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
      displayedColorScheme === 'dark' ||
      (displayedColorScheme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updatePreview = () => {
      setIsDarkForPreview(
        displayedColorScheme === 'dark' ||
          (displayedColorScheme === 'system' &&
            window.matchMedia('(prefers-color-scheme: dark)').matches),
      );
    };

    updatePreview();

    if (displayedColorScheme === 'system') {
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
  }, [displayedColorScheme]);

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
    <div
      className="space-y-6"
      data-theme-switch-ui
    >
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
              const isSelected = displayedColorScheme === theme.value;
              const isPending = pendingColorScheme === theme.value;
              return (
                <Button
                  key={theme.value}
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => {
                    void selectColorScheme(theme.value);
                  }}
                  disabled={themeSwitchBusy}
                  className={cn(
                    'h-10 px-4 flex items-center gap-2 cursor-pointer disabled:cursor-wait',
                    'transition-opacity duration-300 ease-out',
                    isSelected && ['font-semibold'],
                    !isSelected && ['bg-background hover:bg-accent/50', 'text-muted-foreground'],
                    themeSwitchBusy && !isPending
                      ? 'opacity-40 disabled:opacity-40'
                      : 'opacity-100 disabled:opacity-100',
                  )}
                  aria-label={theme.label}
                  title={theme.label}
                  aria-busy={isPending}
                >
                  {isPending ? <ThemeSwitchSpinner className="size-4" /> : <Icon />}
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
            const previewColors = isDarkForPreview ? theme.colors.dark : theme.colors.light;
            return (
              <button
                key={theme.name}
                type="button"
                onClick={() => {
                  void selectTheme(theme.name);
                }}
                disabled={themeSwitchBusy}
                className={cn(
                  'relative text-left transition-[opacity,transform] duration-300 ease-out',
                  themeSwitchBusy ? 'cursor-wait' : 'cursor-pointer',
                  isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  themeSwitchBusy && pendingThemeName !== theme.name && 'opacity-40 scale-[0.99]',
                  (!themeSwitchBusy || pendingThemeName === theme.name) && 'opacity-100 scale-100',
                )}
                style={{ borderRadius: previewRadius(previewColors.radius) }}
                aria-label={theme.displayName}
                aria-pressed={isSelected}
                aria-busy={pendingThemeName === theme.name}
              >
                <ThemePreview
                  theme={theme}
                  isSelected={isSelected || pendingThemeName === theme.name}
                  isDark={isDarkForPreview}
                  isPending={pendingThemeName === theme.name}
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
