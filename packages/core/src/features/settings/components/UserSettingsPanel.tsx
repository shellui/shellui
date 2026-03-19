import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui, type Settings } from '@shellui/sdk';
import type { AuthUser } from '../../auth/hooks/useAuth';
import { decodeJwtPayload } from '../../auth/utils/decodeJwtPayload';
import { Button } from '../../../components/ui/button';

const formatLoginMethod = (
  authProvider: string | null,
  t: (key: string, options?: { [key: string]: string }) => string,
) => {
  if (!authProvider) return t('userAccount.loginMethods.unknown');
  const normalized = authProvider.toLowerCase();
  if (normalized === 'email') return t('userAccount.loginMethods.magicLinkEmail');
  if (normalized === 'github') return t('userAccount.loginMethods.github');
  return authProvider.charAt(0).toUpperCase() + authProvider.slice(1);
};

export const UserSettingsPanel = ({
  user,
  onLogout,
  developerModeEnabled,
  accessToken,
  settingsAccessToken,
  rawUserSettings,
}: {
  user: AuthUser;
  onLogout: () => Promise<void>;
  developerModeEnabled: boolean;
  accessToken: string | null;
  settingsAccessToken: string | null;
  rawUserSettings: Settings['user'];
}) => {
  const { t } = useTranslation('settings');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const decodedJwtPayload = useMemo(
    () => (accessToken ? decodeJwtPayload(accessToken) : null),
    [accessToken],
  );

  const rawUserSettingsJson = useMemo(
    () => JSON.stringify(rawUserSettings ?? null, null, 2),
    [rawUserSettings],
  );
  const jwtPayloadJson = useMemo(
    () =>
      accessToken
        ? JSON.stringify(
            decodedJwtPayload ?? t('userAccount.developerDiagnostics.unableToDecodeJwtPayload'),
            null,
            2,
          )
        : t('userAccount.developerDiagnostics.noAccessTokenAvailable'),
    [accessToken, decodedJwtPayload, t],
  );
  const settingsAccessTokenText =
    settingsAccessToken || t('userAccount.developerDiagnostics.notSharedForApp');
  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      shellui.sendMessageToParent({
        type: 'SHELLUI_LOGOUT',
        payload: {},
      });
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  }, [onLogout]);
  const handleCopyDeveloperDiagnostics = useCallback(async (label: string, value: string) => {
    if (!navigator?.clipboard?.writeText) {
      shellui.toast({
        title: t('userAccount.clipboard.copyFailedTitle'),
        description: t('userAccount.clipboard.clipboardApiUnavailable'),
        type: 'error',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      shellui.toast({
        title: t('userAccount.clipboard.copiedTitle'),
        description: t('userAccount.clipboard.copiedDescription', { label }),
        type: 'success',
      });
    } catch {
      shellui.toast({
        title: t('userAccount.clipboard.copyFailedTitle'),
        description: t('userAccount.clipboard.unableToCopyDiagnostics'),
        type: 'error',
      });
    }
  }, [t]);

  return (
    <section className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        {user.profilePicture ? (
          <img
            src={user.profilePicture}
            alt={
              user.name
                ? t('userAccount.profile.avatarAltWithName', { name: user.name })
                : t('userAccount.profile.avatarAltDefault')
            }
            className="h-12 w-12 rounded-full border border-border object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground">
            {user.name?.charAt(0).toUpperCase() ||
              user.email?.charAt(0).toUpperCase() ||
              t('userAccount.profile.placeholderInitial')}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-foreground">
            {user.name || t('userAccount.profile.unknownUser')}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {user.email || t('userAccount.profile.noEmail')}
          </p>
        </div>
      </div>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('userAccount.fields.name')}</dt>
          <dd className="mt-0.5 text-foreground">{user.name || '-'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('userAccount.fields.email')}</dt>
          <dd className="mt-0.5 text-foreground">{user.email || '-'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('userAccount.fields.loginMethod')}</dt>
          <dd className="mt-0.5 text-foreground">{formatLoginMethod(user.authProvider, t)}</dd>
        </div>
      </dl>

      {developerModeEnabled && (
        <div className="rounded-lg bg-muted/40 p-3">
          <h3
            className="text-sm font-semibold text-foreground"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('userAccount.developerDiagnostics.title')}
          </h3>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground">{t('userAccount.developerDiagnostics.jwtPayload')}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    void handleCopyDeveloperDiagnostics(
                      t('userAccount.developerDiagnostics.jwtPayload'),
                      jwtPayloadJson,
                    )
                  }
                >
                  {t('userAccount.developerDiagnostics.copy')}
                </Button>
              </div>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs text-foreground">
                {jwtPayloadJson}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground">
                  {t('userAccount.developerDiagnostics.sharedSettingsAccessToken')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    void handleCopyDeveloperDiagnostics(
                      t('userAccount.developerDiagnostics.sharedSettingsAccessToken'),
                      settingsAccessTokenText,
                    )
                  }
                >
                  {t('userAccount.developerDiagnostics.copy')}
                </Button>
              </div>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs text-foreground">
                {settingsAccessTokenText}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground">
                  {t('userAccount.developerDiagnostics.rawUserSettings')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    void handleCopyDeveloperDiagnostics(
                      t('userAccount.developerDiagnostics.rawUserSettings'),
                      rawUserSettingsJson,
                    )
                  }
                >
                  {t('userAccount.developerDiagnostics.copy')}
                </Button>
              </div>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs text-foreground">
                {rawUserSettingsJson}
              </pre>
            </div>
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        className="mt-4 w-full sm:w-auto"
        onClick={() => void handleLogout()}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? t('userAccount.actions.loggingOut') : t('userAccount.actions.logout')}
      </Button>
    </section>
  );
};
