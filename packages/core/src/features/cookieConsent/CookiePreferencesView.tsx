import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { shellui } from '@shellui/sdk';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useConfig } from '../config/useConfig';
import { useSettings } from '../settings/hooks/useSettings';
import type { CookieConsentCategory, CookieDefinition } from '../config/types';

/** Category display order and labels */
const CATEGORY_ORDER: CookieConsentCategory[] = [
  'strict_necessary',
  'functional_performance',
  'targeting',
  'social_media_embedded',
];

/** Format duration in human-readable format */
function formatDuration(seconds: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (seconds < 60) return t('preferences.duration.seconds', { count: seconds });
  if (seconds < 3600) return t('preferences.duration.minutes', { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('preferences.duration.hours', { count: Math.floor(seconds / 3600) });
  if (seconds < 31536000) return t('preferences.duration.days', { count: Math.floor(seconds / 86400) });
  return t('preferences.duration.years', { count: Math.floor(seconds / 31536000) });
}

export function CookiePreferencesView() {
  const { t } = useTranslation('cookieConsent');
  const { config } = useConfig();
  const { settings, updateSetting } = useSettings();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isInitialConsent = searchParams.get('initial') === 'true';

  const cookies = config?.cookieConsent?.cookies ?? [];
  const allHosts = useMemo(() => cookies.map((c) => c.host), [cookies]);

  // Strictly necessary hosts are always enabled
  const strictNecessaryHosts = useMemo(
    () => cookies.filter((c) => c.category === 'strict_necessary').map((c) => c.host),
    [cookies]
  );

  const currentAcceptedHosts = settings?.cookieConsent?.acceptedHosts ?? [];

  // Local state for unsaved changes (always include strict necessary)
  const [localAcceptedHosts, setLocalAcceptedHosts] = useState<string[]>(() =>
    [...new Set([...currentAcceptedHosts, ...strictNecessaryHosts])]
  );

  // Track if save/accept/reject was clicked to avoid rejecting on intentional close
  const actionClickedRef = useRef(false);

  // Reset local state when drawer opens (when URL changes to include initial param)
  useEffect(() => {
    if (isInitialConsent) {
      // Always include strict necessary hosts
      setLocalAcceptedHosts([...new Set([...currentAcceptedHosts, ...strictNecessaryHosts])]);
    }
  }, [isInitialConsent, currentAcceptedHosts, strictNecessaryHosts]);

  // Handle drawer close without saving during initial consent
  useEffect(() => {
    if (!isInitialConsent) return;

    const handleDrawerClose = () => {
      // If closing without saving during initial consent, reject all except strict necessary
      // Check if user has never consented and no action was clicked
      const neverConsented = (settings?.cookieConsent?.consentedCookieHosts ?? []).length === 0;
      if (neverConsented && !actionClickedRef.current) {
        updateSetting('cookieConsent', {
          acceptedHosts: strictNecessaryHosts,
          consentedCookieHosts: allHosts,
        });
      }
    };

    const cleanup = shellui.addMessageListener('SHELLUI_CLOSE_DRAWER', handleDrawerClose);
    return cleanup;
  }, [isInitialConsent, strictNecessaryHosts, allHosts, updateSetting, settings]);

  // Cleanup on unmount: if initial consent and drawer closes without save, reject all
  useEffect(() => {
    return () => {
      if (isInitialConsent && !actionClickedRef.current) {
        // Check if user has never consented
        const neverConsented = (settings?.cookieConsent?.consentedCookieHosts ?? []).length === 0;
        if (neverConsented) {
          updateSetting('cookieConsent', {
            acceptedHosts: strictNecessaryHosts,
            consentedCookieHosts: allHosts,
          });
        }
      }
    };
  }, [isInitialConsent, strictNecessaryHosts, allHosts, updateSetting, settings]);

  // Group cookies by category
  const cookiesByCategory = useMemo(() => {
    const grouped = new Map<CookieConsentCategory, CookieDefinition[]>();
    for (const cookie of cookies) {
      const existing = grouped.get(cookie.category) ?? [];
      grouped.set(cookie.category, [...existing, cookie]);
    }
    return grouped;
  }, [cookies]);

  // Toggle individual cookie
  const toggleCookie = useCallback((host: string, enabled: boolean) => {
    setLocalAcceptedHosts((prev) =>
      enabled ? [...prev, host] : prev.filter((h) => h !== host)
    );
  }, []);

  // Toggle entire category
  const toggleCategory = useCallback(
    (category: CookieConsentCategory, enabled: boolean) => {
      const categoryHosts = cookiesByCategory.get(category)?.map((c) => c.host) ?? [];
      setLocalAcceptedHosts((prev) => {
        if (enabled) {
          return [...new Set([...prev, ...categoryHosts])];
        } else {
          const hostsSet = new Set(categoryHosts);
          return prev.filter((h) => !hostsSet.has(h));
        }
      });
    },
    [cookiesByCategory]
  );

  // Check if category is fully or partially enabled
  const getCategoryState = useCallback(
    (category: CookieConsentCategory): 'all' | 'some' | 'none' => {
      const categoryHosts = cookiesByCategory.get(category)?.map((c) => c.host) ?? [];
      if (categoryHosts.length === 0) return 'none';
      const enabledCount = categoryHosts.filter((h) => localAcceptedHosts.includes(h)).length;
      if (enabledCount === categoryHosts.length) return 'all';
      if (enabledCount > 0) return 'some';
      return 'none';
    },
    [cookiesByCategory, localAcceptedHosts]
  );

  // Accept all
  const handleAcceptAll = useCallback(() => {
    actionClickedRef.current = true;
    updateSetting('cookieConsent', {
      acceptedHosts: allHosts,
      consentedCookieHosts: allHosts,
    });
    shellui.closeDrawer();
  }, [allHosts, updateSetting]);

  // Reject all except strict necessary (which are always enabled)
  const handleRejectAll = useCallback(() => {
    actionClickedRef.current = true;
    updateSetting('cookieConsent', {
      acceptedHosts: strictNecessaryHosts,
      consentedCookieHosts: allHosts,
    });
    shellui.closeDrawer();
  }, [strictNecessaryHosts, allHosts, updateSetting]);

  // Save custom preferences (always include strict necessary)
  const handleSave = useCallback(() => {
    actionClickedRef.current = true;
    const hostsToSave = [...new Set([...localAcceptedHosts, ...strictNecessaryHosts])];
    updateSetting('cookieConsent', {
      acceptedHosts: hostsToSave,
      consentedCookieHosts: allHosts,
    });
    shellui.closeDrawer();
  }, [localAcceptedHosts, strictNecessaryHosts, allHosts, updateSetting]);

  // Check if preferences have changed
  const hasChanges = useMemo(() => {
    if (localAcceptedHosts.length !== currentAcceptedHosts.length) return true;
    const sortedLocal = [...localAcceptedHosts].sort();
    const sortedCurrent = [...currentAcceptedHosts].sort();
    return sortedLocal.some((h, i) => h !== sortedCurrent[i]);
  }, [localAcceptedHosts, currentAcceptedHosts]);

  if (cookies.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-muted-foreground">{t('preferences.noCookies')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex flex-col space-y-2 border-b border-border/60 px-6 pt-5 pb-4">
        <h2
          className="text-lg font-semibold leading-none tracking-tight"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('preferences.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('preferences.description')}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {CATEGORY_ORDER.map((category) => {
          const categoryCookies = cookiesByCategory.get(category);
          if (!categoryCookies || categoryCookies.length === 0) return null;

          const categoryState = getCategoryState(category);
          const isStrictNecessary = category === 'strict_necessary';

          return (
            <div key={category} className="mb-6 last:mb-0">
              {/* Category header with toggle */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-sm font-semibold"
                    style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
                  >
                    {t(`preferences.categories.${category}.title`)}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(`preferences.categories.${category}.description`)}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  {!isStrictNecessary && categoryState === 'some' && (
                    <span className="text-xs text-muted-foreground">
                      {t('preferences.partial')}
                    </span>
                  )}
                  {isStrictNecessary ? (
                    <span className="text-xs text-muted-foreground">
                      {t('preferences.alwaysOn')}
                    </span>
                  ) : (
                    <Switch
                      checked={categoryState === 'all'}
                      onCheckedChange={(checked) => toggleCategory(category, checked)}
                      aria-label={t(`preferences.categories.${category}.title`)}
                    />
                  )}
                </div>
              </div>

              {/* Individual cookies - only show for non-strictly-necessary categories */}
              {!isStrictNecessary && (
                <div className="space-y-2 pl-2 border-l-2 border-border ml-1">
                  {categoryCookies.map((cookie) => {
                    const isEnabled = localAcceptedHosts.includes(cookie.host);
                    return (
                      <div
                        key={cookie.host}
                        className="flex items-start justify-between gap-3 py-2 px-3 rounded-md bg-muted/30"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate">
                            {cookie.name}
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {cookie.description}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/70">
                            <span>{cookie.host}</span>
                            <span>•</span>
                            <span>{formatDuration(cookie.durationSeconds, t)}</span>
                            <span>•</span>
                            <span className="capitalize">
                              {cookie.type.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => toggleCookie(cookie.host, checked)}
                          aria-label={cookie.name}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-2 border-t border-border px-6 py-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRejectAll}
            className="flex-1"
          >
            {t('preferences.rejectAll')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAcceptAll}
            className="flex-1"
          >
            {t('preferences.acceptAll')}
          </Button>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges && !isInitialConsent}
          className="w-full"
        >
          {t('preferences.save')}
        </Button>
      </div>
    </div>
  );
}
