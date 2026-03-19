import { useCallback, useMemo, useState } from 'react';
import { shellui, type Settings } from '@shellui/sdk';
import type { AuthUser } from '../../auth/hooks/useAuth';
import { decodeJwtPayload } from '../../auth/utils/decodeJwtPayload';
import { Button } from '../../../components/ui/button';

const formatLoginMethod = (authProvider: string | null) => {
  if (!authProvider) return 'Unknown';
  const normalized = authProvider.toLowerCase();
  if (normalized === 'email') return 'Magic link (Email)';
  if (normalized === 'github') return 'GitHub';
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
        ? JSON.stringify(decodedJwtPayload ?? 'Unable to decode JWT payload.', null, 2)
        : 'No access token available.',
    [accessToken, decodedJwtPayload],
  );
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

  return (
    <section className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        {user.profilePicture ? (
          <img
            src={user.profilePicture}
            alt={user.name ? `${user.name} avatar` : 'User avatar'}
            className="h-12 w-12 rounded-full border border-border object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground">
            {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-foreground">
            {user.name || 'Unknown user'}
          </p>
          <p className="truncate text-sm text-muted-foreground">{user.email || 'No email'}</p>
        </div>
      </div>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Name</dt>
          <dd className="mt-0.5 text-foreground">{user.name || '-'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="mt-0.5 text-foreground">{user.email || '-'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Login method</dt>
          <dd className="mt-0.5 text-foreground">{formatLoginMethod(user.authProvider)}</dd>
        </div>
      </dl>

      {developerModeEnabled && (
        <div className="rounded-lg bg-muted/40 p-3">
          <h3
            className="text-sm font-semibold text-foreground"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            Developer diagnostics
          </h3>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">JWT payload</p>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs text-foreground">
                {jwtPayloadJson}
              </pre>
            </div>
            <div>
              <p className="text-muted-foreground">Shared settings access token</p>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs text-foreground">
                {settingsAccessToken || 'Not shared for this app.'}
              </pre>
            </div>
            <div>
              <p className="text-muted-foreground">Raw user settings</p>
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
        {isLoggingOut ? 'Logging out...' : 'Logout'}
      </Button>
    </section>
  );
};
