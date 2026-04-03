import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui, type Settings } from '@shellui/sdk';
import type { AuthUser } from '../../auth/hooks/useAuth';
import { decodeJwtPayload } from '../../auth/utils/decodeJwtPayload';
import { Button } from '../../../components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';
import { useSettings } from '../hooks/useSettings';

const JWT_TIMESTAMP_LINE =
  /^(?<before>\s*"(?:exp|iat)"\s*:\s*)(?<sec>\d+)(?<after>,?\s*)$/;

const formatJwtUnixTooltip = (unixSeconds: number, lang: string, timezone: string): string => {
  const date = new Date(unixSeconds * 1000);
  let absolute: string;
  try {
    absolute = new Intl.DateTimeFormat(lang, {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    absolute = date.toLocaleString(lang);
  }

  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const elapsed = date.getTime() - Date.now();
  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000000],
    ['month', 2629800000],
    ['week', 604800000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ];

  for (const [unit, ms] of divisions) {
    if (Math.abs(elapsed) >= ms || unit === 'second') {
      const relative = rtf.format(Math.round(elapsed / ms), unit);
      return `${relative}\n${absolute}`;
    }
  }

  return absolute;
};

const JwtTimestampInfo = ({
  unixSeconds,
  lang,
  timezone,
  ariaLabel,
}: {
  unixSeconds: number;
  lang: string;
  timezone: string;
  ariaLabel: string;
}) => {
  const tooltip = formatJwtUnixTooltip(unixSeconds, lang, timezone);
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="-mb-0.5 ml-1 inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={ariaLabel}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle
              cx="12"
              cy="12"
              r="10"
            />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        className="max-w-xs whitespace-pre-line text-left"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

const JwtPayloadPre = ({
  jsonText,
  lang,
  timezone,
  timestampAriaLabel,
}: {
  jsonText: string;
  lang: string;
  timezone: string;
  timestampAriaLabel: string;
}) => {
  const lines = jsonText.split('\n');
  return (
    <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs text-foreground">
      {lines.map((line, index) => {
        const match = line.match(JWT_TIMESTAMP_LINE);
        if (!match?.groups) {
          return (
            <span
              key={index}
              className="block"
            >
              {line || '\u00A0'}
            </span>
          );
        }
        const { before, sec, after } = match.groups;
        const unix = Number(sec);
        return (
          <span
            key={index}
            className="block"
          >
            {before}
            {sec}
            {after}
            <JwtTimestampInfo
              unixSeconds={unix}
              lang={lang}
              timezone={timezone}
              ariaLabel={timestampAriaLabel}
            />
          </span>
        );
      })}
    </pre>
  );
};

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
  const { t, i18n } = useTranslation('settings');
  const { settings } = useSettings();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const decodedJwtPayload = useMemo(
    () => (accessToken ? decodeJwtPayload(accessToken) : null),
    [accessToken],
  );

  const lang = settings.language?.code || i18n.language || 'en';
  const timezone =
    settings.region?.timezone ||
    (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) ||
    'UTC';

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
  const handleCopyDeveloperDiagnostics = useCallback(
    async (label: string, value: string) => {
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
    },
    [t],
  );

  const developerDiagnostics: ReactNode = developerModeEnabled ? (
    <TooltipProvider delayDuration={200}>
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
              <p className="text-muted-foreground">
                {t('userAccount.developerDiagnostics.jwtPayload')}
              </p>
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
            {accessToken && decodedJwtPayload ? (
              <JwtPayloadPre
                jsonText={jwtPayloadJson}
                lang={lang}
                timezone={timezone}
                timestampAriaLabel={t(
                  'userAccount.developerDiagnostics.jwtTimestampTooltipAria',
                )}
              />
            ) : (
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs text-foreground">
                {jwtPayloadJson}
              </pre>
            )}
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
    </TooltipProvider>
  ) : null;

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

      {developerDiagnostics}

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
