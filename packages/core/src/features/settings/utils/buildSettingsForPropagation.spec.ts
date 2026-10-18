import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '@shellui/sdk';
import type { AuthSession } from '../../auth/types';
import { frameAuthPropagationOptions } from '../../auth/appBackend/frameAuth';
import type { ShellUIConfig } from '../../config/types';
import { buildSettingsForPropagation } from './buildSettingsForPropagation';

const baseSettings: Settings = {
  developerFeatures: { enabled: false },
  errorReporting: { enabled: true },
  logging: { namespaces: { shellsdk: false, shellcore: false } },
  appearance: {
    name: 'default',
    displayName: 'Default',
    mode: 'light',
    colorScheme: 'light',
    colors: {
      light: {
        background: '#fff',
        foreground: '#000',
        card: '#fff',
        cardForeground: '#000',
        popover: '#fff',
        popoverForeground: '#000',
        primary: '#000',
        primaryForeground: '#fff',
        secondary: '#eee',
        secondaryForeground: '#000',
        muted: '#eee',
        mutedForeground: '#333',
        accent: '#eee',
        accentForeground: '#000',
        destructive: '#f00',
        destructiveForeground: '#fff',
        border: '#ccc',
        input: '#ccc',
        ring: '#000',
        radius: '0.5rem',
        sidebarBackground: '#fff',
        sidebarForeground: '#000',
        sidebarPrimary: '#000',
        sidebarPrimaryForeground: '#fff',
        sidebarAccent: '#eee',
        sidebarAccentForeground: '#000',
        sidebarBorder: '#ccc',
        sidebarRing: '#000',
      },
      dark: {
        background: '#000',
        foreground: '#fff',
        card: '#000',
        cardForeground: '#fff',
        popover: '#000',
        popoverForeground: '#fff',
        primary: '#fff',
        primaryForeground: '#000',
        secondary: '#111',
        secondaryForeground: '#fff',
        muted: '#111',
        mutedForeground: '#ddd',
        accent: '#111',
        accentForeground: '#fff',
        destructive: '#900',
        destructiveForeground: '#fff',
        border: '#333',
        input: '#333',
        ring: '#fff',
        radius: '0.5rem',
        sidebarBackground: '#000',
        sidebarForeground: '#fff',
        sidebarPrimary: '#fff',
        sidebarPrimaryForeground: '#000',
        sidebarAccent: '#111',
        sidebarAccentForeground: '#fff',
        sidebarBorder: '#333',
        sidebarRing: '#fff',
      },
    },
  },
  language: { code: 'en' },
  region: { timezone: 'UTC' },
  cookieConsent: { acceptedHosts: [], consentedCookieHosts: [] },
  serviceWorker: { enabled: false },
  ai: {
    enabled: true,
    defaultModelId: null,
    ollamaEnabled: true,
    browserEnabled: true,
  },
  user: null,
};

describe('buildSettingsForPropagation', () => {
  it('adds localized navigation items and available themes', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://shellui.dev' },
      matchMedia: () => ({ matches: false }),
    });

    const config = {
      navigation: [
        {
          title: 'Main',
          items: [
            {
              label: { en: 'Docs', fr: 'Docs FR' },
              path: '/docs',
              url: '/docs',
            },
          ],
        },
      ],
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'fr');

    expect(result.navigation?.items).toEqual([
      {
        path: '/docs',
        url: '/docs',
        label: 'Docs FR',
      },
    ]);
    expect(result.appearance?.availableThemes?.length).toBeGreaterThan(0);
  });

  it('never propagates refresh tokens to iframe settings', () => {
    const settingsWithRefresh = {
      ...baseSettings,
      refreshToken: 'secret-refresh-token',
    } as Settings & { refreshToken: string };

    const result = buildSettingsForPropagation(settingsWithRefresh, undefined, 'en', {
      includeAuthAccessToken: true,
      accessToken: 'access-jwt',
    });

    expect(result.accessToken).toBe('access-jwt');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('defaults access token to null when includeAuthAccessToken is omitted', () => {
    const result = buildSettingsForPropagation(baseSettings, undefined, 'en', {
      accessToken: 'jwt.should.not.be.exposed',
    });
    expect(result.accessToken).toBeNull();
  });

  it('injects access token into settings only when explicitly allowed', () => {
    const settingsWithUser: Settings = {
      ...baseSettings,
      user: {
        id: 'u1',
        email: 'dev@shellui.dev',
        name: 'Dev User',
        profilePicture: null,
        authProvider: 'github',
      },
    };

    const safeResult = buildSettingsForPropagation(settingsWithUser, undefined, 'en', {
      includeAuthAccessToken: true,
      accessToken: 'jwt.safe.token',
    });
    expect(safeResult.accessToken).toBe('jwt.safe.token');

    const unsafeResult = buildSettingsForPropagation(settingsWithUser, undefined, 'en', {
      includeAuthAccessToken: false,
      accessToken: 'jwt.should.not.be.exposed',
    });
    expect(unsafeResult.accessToken).toBeNull();
  });

  it('injects authBackendBaseUrl when backend type is shellui', () => {
    const config = {
      backend: {
        type: 'shellui' as const,
        url: 'https://id.example.com/',
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.authBackendBaseUrl).toBe('https://id.example.com');
  });

  it('sets authBackendBaseUrl to null when backend is not shellui', () => {
    const config = {
      backend: {
        type: 'supabase' as const,
        url: 'https://xyz.supabase.co',
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.authBackendBaseUrl).toBeNull();
  });

  it('injects localized administration navigation from config', () => {
    const config = {
      storage: { url: 'http://localhost:8001/', filesUrl: 'http://localhost:5175/' },
      administration: {
        title: { en: 'Applications', fr: 'Applications FR' },
        navigation: [
          {
            label: { en: 'Billing', fr: 'Facturation' },
            path: 'billing',
            url: 'https://app.example.com/billing',
            icon: '/icons/billing.svg',
          },
          {
            label: { en: 'Django admin', fr: 'Admin Django' },
            path: 'django-admin',
            url: '/admin/',
            requiresStaff: true,
            openIn: 'external',
          },
        ],
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'fr');
    expect(result.administration).toEqual({
      title: 'Applications FR',
      navigation: [
        {
          path: 'billing',
          url: 'https://app.example.com/billing',
          label: 'Facturation',
          icon: '/icons/billing.svg',
        },
        {
          path: 'django-admin',
          url: '/admin/',
          label: 'Admin Django',
          requiresStaff: true,
          openIn: 'external',
        },
      ],
    });
    expect(result.storage).toEqual({
      url: 'http://localhost:8001',
      filesUrl: 'http://localhost:5175/',
    });
  });

  it('sets administration, storage, and email to null when not configured', () => {
    const result = buildSettingsForPropagation(baseSettings, undefined, 'en');
    expect(result.administration).toBeNull();
    expect(result.storage).toBeNull();
    expect(result.email).toBeNull();
  });

  it('propagates showInAdmin false when hosting admin is disabled', () => {
    const config = {
      hosting: {
        url: 'http://localhost:8002/',
        showInAdmin: false,
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.hosting).toEqual({
      url: 'http://localhost:8002',
      showInAdmin: false,
    });
  });

  it('omits showInAdmin from propagated hosting by default', () => {
    const config = {
      hosting: {
        url: 'http://localhost:8002',
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.hosting).toEqual({ url: 'http://localhost:8002' });
  });

  it('propagates email url and strips a trailing slash', () => {
    const config = {
      email: {
        url: 'http://localhost:8003/',
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.email).toEqual({ url: 'http://localhost:8003' });
  });

  it('uses the production email url when email is set without url', () => {
    const config = {
      email: {},
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.email).toEqual({ url: 'https://email.shellui.com' });
  });

  it('propagates showInAdmin false for email and keeps the default url', () => {
    const config = {
      email: {
        showInAdmin: false,
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.email).toEqual({
      url: 'https://email.shellui.com',
      showInAdmin: false,
    });
  });

  it('omits showInAdmin from propagated email by default', () => {
    const config = {
      email: {
        url: 'https://email.shellui.com',
        showInAdmin: true,
      },
    } as ShellUIConfig;

    const result = buildSettingsForPropagation(baseSettings, config, 'en');
    expect(result.email).toEqual({ url: 'https://email.shellui.com' });
  });

  const shellToken = 'shell-access-token';
  const foreignToken = 'foreign-access-token';
  const shellUser = {
    id: 'shell-user',
    email: 'shell@example.com',
    name: 'Shell User',
    profilePicture: null,
    authProvider: 'google',
    isStaff: true,
  };

  const appConfig = {
    backend: {
      type: 'shellui' as const,
      url: 'https://id.example.com/',
      companyId: 1,
      adminUrl: 'https://admin.example/',
      login: { oauthProviders: ['google'] },
    },
    storage: { url: 'https://files-api.example', filesUrl: 'https://files.example/' },
    navigation: [
      {
        label: 'Billing',
        path: 'billing',
        url: 'https://billing.example/',
        safeForAuthToken: true,
      },
      {
        label: 'Directory',
        path: 'directory',
        url: 'https://directory.example/',
        safeForAuthToken: true,
        backend: {
          url: 'https://id.directory.example/',
          companyId: 4,
          provider: 'google',
        },
      },
      {
        label: 'Public directory',
        path: 'public-directory',
        url: 'https://public.example/',
        backend: { url: 'https://id.public.example' },
      },
    ],
  } as ShellUIConfig;

  const foreignSession = {
    accessToken: foreignToken,
    refreshToken: 'foreign-refresh',
    tokenType: 'bearer',
    expiresAt: 4_000_000_000,
    provider: 'google',
    userId: 'foreign-user',
    userEmail: 'foreign@example.com',
    userName: 'Foreign User',
    userAvatarUrl: null,
    userIsStaff: false,
    userIsCompanyOwner: true,
    userGroups: ['directory'],
  } satisfies AuthSession;

  const propagate = (frameSrc: string, session: AuthSession | null = foreignSession) => {
    const options = frameAuthPropagationOptions({
      frameSrc,
      config: appConfig,
      shellAccessToken: shellToken,
      getAppSession: () => session,
      shellOrigin: 'https://shell.example',
    });
    return buildSettingsForPropagation(
      { ...baseSettings, user: shellUser },
      appConfig,
      'en',
      options,
    );
  };

  it('falls back to the shell backend and token when the app has no override', () => {
    const result = propagate('https://billing.example/');
    expect(result.accessToken).toBe(shellToken);
    expect(result.authBackendBaseUrl).toBe('https://id.example.com');
    expect(result.user?.email).toBe('shell@example.com');
  });

  it('sends each foreign app its own backend URL and token', () => {
    const result = propagate('https://directory.example/people');
    expect(result.accessToken).toBe(foreignToken);
    expect(result.authBackendBaseUrl).toBe('https://id.directory.example');
    expect(result.user).toMatchObject({
      id: 'foreign-user',
      email: 'foreign@example.com',
      groups: ['directory'],
    });
    expect(JSON.stringify(result)).not.toContain(shellToken);
    expect(JSON.stringify(result)).not.toContain('shell@example.com');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('sends a null token, not the shell token, when the foreign session is missing', () => {
    const result = propagate('https://directory.example/', null);
    expect(result.accessToken).toBeNull();
    expect(result.authBackendBaseUrl).toBe('https://id.directory.example');
    expect(result.user).toBeNull();
    expect(JSON.stringify(result)).not.toContain(shellToken);
  });

  it('does not send either token to an untrusted app on another identity server', () => {
    const result = propagate('https://public.example/');
    expect(result.accessToken).toBeNull();
    expect(result.authBackendBaseUrl).toBe('https://id.public.example');
    expect(JSON.stringify(result)).not.toContain(shellToken);
    expect(JSON.stringify(result)).not.toContain(foreignToken);
  });

  it('keeps the shell token for the built-in admin and storage frames', () => {
    const admin = propagate('https://admin.example/#/users');
    const files = propagate('https://files.example/company/docs');
    expect(admin.accessToken).toBe(shellToken);
    expect(admin.authBackendBaseUrl).toBe('https://id.example.com');
    expect(files.accessToken).toBe(shellToken);
    expect(files.authBackendBaseUrl).toBe('https://id.example.com');
  });

  it('keeps the shell token for shell settings even if a root item names another server', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://shell.example' },
      matchMedia: () => ({ matches: false }),
    });
    const withRoot = {
      ...appConfig,
      navigation: [
        ...(appConfig.navigation ?? []),
        {
          label: 'Home',
          path: 'home',
          url: 'https://shell.example/',
          safeForAuthToken: true,
          backend: { url: 'https://id.other.example' },
        },
      ],
    } as ShellUIConfig;
    const options = frameAuthPropagationOptions({
      frameSrc: 'https://shell.example/__settings/storage',
      config: withRoot,
      shellAccessToken: shellToken,
      getAppSession: () => foreignSession,
      shellOrigin: 'https://shell.example',
    });
    const result = buildSettingsForPropagation(
      { ...baseSettings, user: shellUser },
      withRoot,
      'en',
      options,
    );
    expect(result.accessToken).toBe(shellToken);
    expect(result.authBackendBaseUrl).toBe('https://id.example.com');
    expect(result.user?.email).toBe('shell@example.com');
  });
});
