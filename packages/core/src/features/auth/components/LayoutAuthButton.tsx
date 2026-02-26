import { shellui } from '@shellui/sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import urls from '../../../constants/urls';
import { cn } from '../../../lib/utils';
import { useAuth } from '../useAuth';
import { UserIcon } from '../../settings/components/UserIcon';
import { useConfig } from '../../config/useConfig';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';

type LayoutAuthButtonVariant = 'sidebar' | 'appbar' | 'windows';

const authenticatedVariantClassMap: Record<LayoutAuthButtonVariant, string> = {
  sidebar:
    'w-full h-8 rounded-md px-2 text-sm text-left text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
  appbar:
    'h-8 w-8 rounded-md p-0 justify-center text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
  windows:
    'h-8 w-8 rounded-md p-0 justify-center text-xs text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
};

const loggedOutVariantClassMap: Record<LayoutAuthButtonVariant, string> = {
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

const menuClassMap: Record<LayoutAuthButtonVariant, string> = {
  sidebar: 'w-64',
  appbar: 'w-64',
  windows: 'w-60',
};

const menuSideMap: Record<LayoutAuthButtonVariant, 'top' | 'right' | 'bottom'> = {
  sidebar: 'right',
  appbar: 'bottom',
  windows: 'top',
};

const menuAlignMap: Record<LayoutAuthButtonVariant, 'start' | 'end'> = {
  sidebar: 'start',
  appbar: 'end',
  windows: 'end',
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const displayName = useMemo(() => {
    const name = user?.name?.trim();
    const email = user?.email?.trim();
    return name || email || 'User';
  }, [user?.email, user?.name]);

  const fallbackInitial = displayName.charAt(0).toUpperCase();
  const showDisplayName = variant === 'sidebar';
  const showCaret = variant === 'sidebar';

  const baseButtonClasses = cn(
    'inline-flex items-center gap-2 min-w-0 shrink-0 transition-colors cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
    isAuthenticated ? authenticatedVariantClassMap[variant] : loggedOutVariantClassMap[variant],
  );

  const openProfileSettingsModal = useCallback(() => {
    setIsMenuOpen(false);
    shellui.openModal(`${urls.settings}/user`);
  }, []);

  const handleLogout = useCallback(async () => {
    setIsMenuOpen(false);
    shellui.sendMessageToParent({
      type: 'SHELLUI_LOGOUT',
      payload: {},
    });
    await logout();
  }, [logout]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (contentRef.current?.contains(target)) return;
      setIsMenuOpen(false);
    };

    const handleWindowBlur = () => {
      setIsMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isMenuOpen]);

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
    <DropdownMenu
      open={isMenuOpen}
      onOpenChange={setIsMenuOpen}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={baseButtonClasses}
          title={displayName}
          aria-label={`Open account menu for ${displayName}`}
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
          {showDisplayName && <span className="truncate">{displayName}</span>}
          {showCaret && (
            <span
              aria-hidden
              className={cn('ml-auto shrink-0 text-[10px]', isMenuOpen ? 'text-foreground' : 'text-muted-foreground')}
            >
              <SidebarCaretIcon
                isOpen={isMenuOpen}
                className="h-3 w-3"
              />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={contentRef}
        side={menuSideMap[variant]}
        align={menuAlignMap[variant]}
        collisionPadding={8}
        className={cn('p-1.5', menuClassMap[variant])}
        onPointerDownOutside={() => setIsMenuOpen(false)}
        onFocusOutside={() => setIsMenuOpen(false)}
        onEscapeKeyDown={() => setIsMenuOpen(false)}
      >
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate text-sm font-semibold text-popover-foreground">{displayName}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email || 'No email'}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openProfileSettingsModal}>
          <UserIcon />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void handleLogout()}
          className="text-destructive focus:text-destructive"
        >
          <LogoutIcon className="h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SidebarCaretIcon = ({ className, isOpen }: { className?: string; isOpen: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {isOpen ? <path d="m15 6-6 6 6 6" /> : <path d="m9 6 6 6-6 6" />}
  </svg>
);

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line
      x1="21"
      y1="12"
      x2="9"
      y2="12"
    />
  </svg>
);
