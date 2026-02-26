import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import urls from '../../../constants/urls';
import { cn } from '../../../lib/utils';
import { useAuth } from '../useAuth';
import { UserIcon } from '../../settings/components/UserIcon';
import { useConfig } from '../../config/useConfig';
import { UserSettingsPanel } from '../../settings/components/UserSettingsPanel';
import { Dialog, DialogContent, DialogTrigger } from '../../../components/ui/dialog';

type LayoutAuthButtonVariant = 'sidebar' | 'appbar' | 'windows';

const variantClassMap: Record<LayoutAuthButtonVariant, string> = {
  sidebar:
    'w-full h-8 rounded-md px-2 text-sm text-left text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
  appbar:
    'h-8 max-w-[220px] rounded-md px-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
  windows:
    'h-8 max-w-[180px] rounded-md px-2 text-xs text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
};

const avatarClassMap: Record<LayoutAuthButtonVariant, string> = {
  sidebar: 'h-5 w-5',
  appbar: 'h-5 w-5',
  windows: 'h-4 w-4',
};

export const LayoutAuthButton = ({
  variant,
  hideWhenLoggedOut = false,
}: {
  variant: LayoutAuthButtonVariant;
  hideWhenLoggedOut?: boolean;
}) => {
  const { config } = useConfig();
  const { isAuthenticated, user, logout } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const displayName = useMemo(() => {
    const name = user?.name?.trim();
    const email = user?.email?.trim();
    return name || email || 'User';
  }, [user?.email, user?.name]);

  const fallbackInitial = displayName.charAt(0).toUpperCase();

  const baseButtonClasses = cn(
    'inline-flex items-center gap-2 min-w-0 shrink-0 transition-colors cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
    variantClassMap[variant],
  );

  if (!config.backend) {
    return null;
  }

  if (!isAuthenticated && hideWhenLoggedOut) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Link
        to={urls.login}
        className={baseButtonClasses}
        aria-label="Go to login"
        title="Login"
      >
        <UserIcon />
        <span className="truncate">Login</span>
      </Link>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Dialog
      open={isSettingsOpen}
      onOpenChange={setIsSettingsOpen}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={baseButtonClasses}
          title={displayName}
          aria-label={`Open user settings for ${displayName}`}
        >
          {user.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={displayName}
              className={cn(
                'shrink-0 rounded-full border border-sidebar-border object-cover',
                avatarClassMap[variant],
              )}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className={cn(
                'shrink-0 rounded-full border border-sidebar-border bg-muted flex items-center justify-center text-[10px] font-semibold',
                avatarClassMap[variant],
              )}
              aria-hidden
            >
              {fallbackInitial}
            </span>
          )}
          <span className="truncate">{displayName}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-0">
        <UserSettingsPanel
          user={user}
          onLogout={logout}
        />
      </DialogContent>
    </Dialog>
  );
};
