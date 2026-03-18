import { shellui } from '@shellui/sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import urls from '../../../constants/urls';
import { cn } from '../../../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { UserIcon } from '../../settings/components/UserIcon';
import { useConfig } from '../../config/useConfig';
import { flattenNavigationItems, getNavPathPrefix } from '../../layouts/utils';
import { LogoutIcon, SidebarCaretIcon } from './LoginButtonIcons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';

type LoginButtonVariant = 'sidebar' | 'appbar' | 'windows';

const variantConfig: Record<
  LoginButtonVariant,
  {
    button: { authenticated: string; loggedOut: string };
    avatar: string;
    menu: { width: string; side: 'top' | 'right' | 'bottom'; align: 'start' | 'end' };
    showDisplayName: boolean;
    showCaret: boolean;
  }
> = {
  sidebar: {
    button: {
      authenticated:
        'w-full h-8 rounded-md px-2 text-sm text-left text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
      loggedOut:
        'w-full h-8 rounded-md px-2 text-sm text-left text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
    },
    avatar: 'h-5 w-5',
    menu: { width: 'w-64', side: 'right', align: 'start' },
    showDisplayName: true,
    showCaret: true,
  },
  appbar: {
    button: {
      authenticated:
        'h-8 w-8 rounded-md p-0 justify-center text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
      loggedOut:
        'h-8 max-w-[220px] rounded-md px-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
    },
    avatar: 'h-5 w-5',
    menu: { width: 'w-64', side: 'bottom', align: 'end' },
    showDisplayName: false,
    showCaret: false,
  },
  windows: {
    button: {
      authenticated:
        'h-8 w-8 rounded-md p-0 justify-center text-xs text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
      loggedOut:
        'h-8 max-w-[180px] rounded-md px-2 text-xs text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
    },
    avatar: 'h-4 w-4',
    menu: { width: 'w-60', side: 'top', align: 'end' },
    showDisplayName: false,
    showCaret: false,
  },
};

export const LoginButton = ({
  variant,
  hideWhenLoggedOut = false,
}: {
  variant: LoginButtonVariant;
  hideWhenLoggedOut?: boolean;
}) => {
  const currentVariantConfig = variantConfig[variant];
  const { config } = useConfig();
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const displayName = useMemo(() => {
    const name = user?.name?.trim();
    const email = user?.email?.trim();
    return name || email || 'User';
  }, [user?.email, user?.name]);

  const fallbackInitial = displayName.charAt(0).toUpperCase();
  const { showDisplayName, showCaret } = currentVariantConfig;

  const baseButtonClasses = cn(
    'inline-flex items-center gap-2 min-w-0 shrink-0 transition-colors cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
    isAuthenticated
      ? currentVariantConfig.button.authenticated
      : currentVariantConfig.button.loggedOut,
  );
  const isOnRequiredAuthRoute = useMemo(() => {
    const nav = config.navigation;
    if (!nav || nav.length === 0) return false;
    const requiredItems = flattenNavigationItems(nav).filter((item) => item.requiresAuth);
    if (requiredItems.length === 0) return false;
    return requiredItems.some((item) => {
      const pathPrefix = getNavPathPrefix(item);
      return (
        location.pathname === pathPrefix ||
        location.pathname.startsWith(`${pathPrefix === '/' ? '' : pathPrefix}/`)
      );
    });
  }, [config.navigation, location.pathname]);

  const openProfileSettingsModal = useCallback(() => {
    setIsMenuOpen(false);
    shellui.openModal(`${urls.settings}/user`);
  }, []);

  const handleLogout = useCallback(async () => {
    setIsMenuOpen(false);
    if (isOnRequiredAuthRoute) {
      navigate('/', { replace: true });
    }
    shellui.sendMessageToParent({
      type: 'SHELLUI_LOGOUT',
      payload: {},
    });
    await logout();
  }, [isOnRequiredAuthRoute, logout, navigate]);

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
                currentVariantConfig.avatar,
              )}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className={cn(
                'shrink-0 rounded-full border border-sidebar-border bg-muted flex items-center justify-center text-[10px] font-semibold',
                currentVariantConfig.avatar,
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
              className={cn(
                'ml-auto shrink-0 text-[10px]',
                isMenuOpen ? 'text-foreground' : 'text-muted-foreground',
              )}
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
        forceMount
        data-auth-menu-content
        side={currentVariantConfig.menu.side}
        align={currentVariantConfig.menu.align}
        collisionPadding={8}
        className={cn('p-1.5', currentVariantConfig.menu.width)}
        onPointerDownOutside={() => setIsMenuOpen(false)}
        onFocusOutside={() => setIsMenuOpen(false)}
        onEscapeKeyDown={() => setIsMenuOpen(false)}
      >
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate text-sm font-semibold text-popover-foreground">{displayName}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {user.email || 'No email'}
          </p>
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
