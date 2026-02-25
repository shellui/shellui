import { useCallback, useState } from 'react';
import type { AuthUser } from '../../auth/useAuth';
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
}: {
  user: AuthUser;
  onLogout: () => Promise<void>;
}) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  }, [onLogout]);

  return (
    <section className="max-w-xl rounded-lg border border-border bg-card p-4">
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
          <p className="truncate text-base font-medium text-foreground">{user.name || 'Unknown user'}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email || 'No email'}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Name</dt>
          <dd className="text-foreground">{user.name || '-'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="text-foreground">{user.email || '-'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">ID</dt>
          <dd className="break-all font-mono text-foreground">{user.id || '-'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Login method</dt>
          <dd className="text-foreground">{formatLoginMethod(user.authProvider)}</dd>
        </div>
      </dl>

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
