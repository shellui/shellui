import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import { useSettings } from '../hooks/useSettings';
import { useConfig } from '../../config/useConfig';
import { flattenNavigationItems, resolveLocalizedString } from '../../layouts/utils';
import { Switch } from '../../../components/ui/switch';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { ToastTestButtons } from './develop/ToastTestButtons';
import { DialogTestButtons } from './develop/DialogTestButtons';
import { ModalTestButtons } from './develop/ModalTestButtons';
import { DrawerTestButtons } from './develop/DrawerTestButtons';
import { captureException } from '../../sentry/initSentry';
import { useCookieConsent } from '../../cookieConsent/useCookieConsent';
import type { LayoutType } from '../../config/types';

type SentryGlobals = {
  __SHELLUI_SENTRY_DSN__?: string;
  __SHELLUI_SENTRY_ENVIRONMENT__?: string;
  __SHELLUI_SENTRY_RELEASE__?: string;
};

export const Develop = () => {
  const { t } = useTranslation('settings');
  const { settings, updateSetting } = useSettings();
  const { config } = useConfig();
  const currentLanguage = settings.language?.code || 'en';
  const effectiveLayout: LayoutType = settings.layout ?? config?.layout ?? 'sidebar';
  const navItems = config?.navigation?.length
    ? flattenNavigationItems(config?.navigation ?? []).filter(
        (item, index, self) => index === self.findIndex((i) => i.path === item.path),
      )
    : [];
  // Check Sentry globals and cookie consent for error reporting test
  const g = globalThis as unknown as SentryGlobals;
  const errorReportingConfigured = Boolean(g.__SHELLUI_SENTRY_DSN__);
  const { isAccepted: sentryConsentAccepted } = useCookieConsent('sentry.io');

  return (
    <div className="space-y-6">
      <div>
        <h3
          className="text-lg font-semibold mb-2"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('develop.logging.title')}
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label
                htmlFor="log-shellsdk"
                className="text-sm font-medium leading-none"
                style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
              >
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
                    shellsdk: checked,
                  },
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label
                htmlFor="log-shellcore"
                className="text-sm font-medium leading-none"
                style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
              >
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
                    shellcore: checked,
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <div>
        <h3
          className="text-lg font-semibold mb-2"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('develop.navigation.title')}
        </h3>
        {navItems.length ? (
          <div className="space-y-2">
            <label
              htmlFor="develop-nav-select"
              className="text-sm font-medium leading-none"
              style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
            >
              {t('develop.navigation.selectLabel')}
            </label>
            <div className="mt-2">
              <Select
                id="develop-nav-select"
                defaultValue=""
                onChange={(e) => {
                  const path = e.target.value;
                  if (path) {
                    shellui.navigate(path.startsWith('/') ? path : `/${path}`);
                  }
                }}
              >
                <option value="">{t('develop.navigation.placeholder')}</option>
                {navItems.map((item) => (
                  <option
                    key={item.path}
                    value={`/${item.path}`}
                  >
                    {resolveLocalizedString(item.label, currentLanguage) || item.path}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('develop.navigation.empty')}</p>
        )}
      </div>

      <div>
        <h3
          className="text-lg font-semibold mb-2"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('develop.layout.title')}
        </h3>
        <div className="flex flex-wrap gap-2">
          {(['sidebar', 'windows'] as const).map((layoutMode) => (
            <Button
              key={layoutMode}
              variant={effectiveLayout === layoutMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSetting('layout', layoutMode as LayoutType)}
            >
              {t(`develop.layout.${layoutMode}`)}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <h3
          className="text-lg font-semibold mb-2"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('develop.testing.title')}
        </h3>
        <div className="space-y-4">
          <ToastTestButtons />
          <DialogTestButtons />
          <ModalTestButtons />
          <DrawerTestButtons />
          {errorReportingConfigured && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span
                  className="text-sm font-medium leading-none"
                  style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
                >
                  Test Error Reporting
                </span>
                <p className="text-sm text-muted-foreground">
                  Trigger a test error to verify Sentry is working correctly
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!sentryConsentAccepted) {
                    shellui.toast({
                      title: 'Cookie consent required',
                      description: 'Please approve Sentry cookie consent in Data Privacy settings to test error reporting.',
                      type: 'error',
                    });
                    return;
                  }
                  
                  const testError = new Error('This is your first error!');
                  
                  try {
                    // Ensure Sentry is initialized and capture the error
                    await captureException(testError);
                    
                    // Show success toast
                    shellui.toast({
                      title: 'Test error triggered',
                      description: 'The error has been sent to Sentry for tracking.',
                      type: 'success',
                    });
                  } catch (err) {
                    // If Sentry capture failed, show error toast
                    shellui.toast({
                      title: 'Failed to send error to Sentry',
                      description: err instanceof Error ? err.message : 'Sentry is not configured or not available.',
                      type: 'error',
                    });
                  }
                }}
                disabled={!sentryConsentAccepted}
              >
                Break the world
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
