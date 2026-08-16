import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '../../../components/ui/switch';
import { useConfig } from '../../config/useConfig';
import { closeSentry, initSentry } from '../../sentry/initSentry';
import { useSettings } from '../hooks/useSettings';
import { Button } from '../../../components/ui/button';
import { shellui } from '@shellui/sdk';
import { useCookieConsent } from '../../cookieConsent/useCookieConsent';
import { AlertTriangleIcon, ChevronDownIcon, CodeIcon } from '../SettingsIcons';
import { cn } from '../../../lib/utils';

export const Advanced = () => {
  const { t } = useTranslation('settings');
  const { config } = useConfig();
  const { settings, updateSetting, resetAllData } = useSettings();
  const errorReportingConfigured = Boolean(config?.sentry?.dsn);
  const { isAccepted: sentryConsentAccepted } = useCookieConsent('sentry.io');
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);

  const handleErrorReportingChange = (checked: boolean) => {
    // Don't allow enabling if cookie consent hasn't been approved
    if (checked && !sentryConsentAccepted) {
      shellui.toast({
        title: 'Cookie consent required',
        description:
          'Please approve Sentry cookie consent in Data Privacy settings to enable error reporting.',
        type: 'error',
      });
      return;
    }
    updateSetting('errorReporting', { enabled: checked });
    if (checked) {
      initSentry();
    } else {
      closeSentry();
    }
  };

  const handleResetClick = () => {
    shellui.dialog({
      title: t('advanced.dangerZone.reset.toast.title'),
      description: t('advanced.dangerZone.reset.toast.description'),
      mode: 'delete',
      size: 'sm',
      okLabel: t('advanced.dangerZone.reset.toast.confirm'),
      cancelLabel: t('advanced.dangerZone.reset.toast.cancel'),
      onOk: () => {
        resetAllData();
        shellui.toast({
          title: t('advanced.dangerZone.reset.toast.success.title'),
          description: t('advanced.dangerZone.reset.toast.success.description'),
          type: 'success',
        });
        shellui.navigate('/');
      },
      onCancel: () => {
        // User cancelled, no action needed
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span
            className="text-sm font-medium leading-none"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('advanced.errorReporting.label')}
          </span>
          <p className="text-sm text-muted-foreground">
            {errorReportingConfigured
              ? sentryConsentAccepted
                ? t('advanced.errorReporting.statusConfigured')
                : 'Cookie consent required to enable error reporting'
              : t('advanced.errorReporting.statusNotConfigured')}
          </p>
        </div>
        {errorReportingConfigured && (
          <Switch
            id="error-reporting"
            checked={sentryConsentAccepted && settings.errorReporting.enabled}
            onCheckedChange={handleErrorReportingChange}
            disabled={!sentryConsentAccepted}
          />
        )}
      </div>

      <div
        className={cn(
          'rounded-lg border p-4 transition-colors',
          settings.developerFeatures.enabled
            ? 'border-primary/40 bg-primary/5'
            : 'border-border bg-muted/30',
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
              settings.developerFeatures.enabled
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
            aria-hidden
          >
            <CodeIcon />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="developer-features"
                    className="text-sm font-medium leading-none"
                    style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
                  >
                    {t('advanced.developerFeatures.label')}
                  </label>
                  {settings.developerFeatures.enabled && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {t('advanced.developerFeatures.badge')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('advanced.developerFeatures.description')}
                </p>
              </div>
              <Switch
                id="developer-features"
                checked={settings.developerFeatures.enabled}
                onCheckedChange={(checked) =>
                  updateSetting('developerFeatures', { enabled: checked })
                }
              />
            </div>
            <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {settings.developerFeatures.enabled
                  ? t('advanced.developerFeatures.hintEnabled')
                  : t('advanced.developerFeatures.hintDisabled')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5">
          <button
            type="button"
            className="flex w-full cursor-pointer items-start gap-3 p-4 text-left"
            aria-expanded={dangerZoneOpen}
            onClick={() => setDangerZoneOpen((open) => !open)}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-destructive/15 text-destructive"
              aria-hidden
            >
              <AlertTriangleIcon />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className="text-sm font-semibold leading-none text-destructive"
                  style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
                >
                  {t('advanced.dangerZone.title')}
                </h3>
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  {t('advanced.dangerZone.badge')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('advanced.dangerZone.description')}
              </p>
            </div>
            <ChevronDownIcon
              className={cn(
                'mt-1 shrink-0 text-destructive transition-transform',
                dangerZoneOpen && 'rotate-180',
              )}
            />
          </button>

          {dangerZoneOpen && (
            <div className="space-y-3 border-t border-destructive/20 px-4 pb-4 pt-3">
              <div className="space-y-1">
                <label
                  className="text-sm font-medium leading-none"
                  style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
                >
                  {t('advanced.dangerZone.reset.title')}
                </label>
                <p className="text-sm text-muted-foreground">
                  {t('advanced.dangerZone.reset.warning')}
                </p>
              </div>

              <Button
                variant="destructive"
                onClick={handleResetClick}
                className="w-full sm:w-auto"
              >
                {t('advanced.dangerZone.reset.button')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
