import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  beginDesktopOAuth,
  buildDesktopAuthorizeUrl,
  configureDesktopAuth,
  ensureDesktopDeepLinkListener,
  handleDesktopAuthCallback,
  resetDesktopAuthState,
  setActiveDesktopScheme,
  shouldUseDesktopSignIn,
  subscribeDesktopAuth,
  createAndStoreDesktopPkce,
  type DesktopAuthEvent,
} from './desktopSignIn';

const SCHEME = 'shellui-playground';

describe('desktop sign-in', () => {
  afterEach(() => {
    resetDesktopAuthState();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('browser runtime keeps the web flow even when a scheme is configured', () => {
    expect(
      shouldUseDesktopSignIn(
        {
          backend: { type: 'shellui', url: 'https://auth.example.com' },
          auth: { desktopScheme: SCHEME },
        },
        false,
      ),
    ).toBe(false);
    expect(
      shouldUseDesktopSignIn(
        { backend: { type: 'shellui', url: 'https://auth.example.com' } },
        true,
      ),
    ).toBe(false);
    expect(
      shouldUseDesktopSignIn(
        {
          backend: { type: 'supabase', url: 'https://auth.example.com' },
          auth: { desktopScheme: SCHEME },
        },
        true,
      ),
    ).toBe(false);
  });

  test('authorize URL sends the custom-scheme redirect and an S256 challenge', () => {
    const url = new URL(
      buildDesktopAuthorizeUrl({
        backendUrl: 'https://auth.example.com/',
        companyId: '7',
        provider: 'github',
        oauthClientId: 4,
        redirectTo: 'shellui-playground://callback',
        codeChallenge: 'challenge-value',
        clientTimezone: 'Europe/Paris',
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe('https://auth.example.com/api/v1/authorize');
    expect(url.searchParams.get('redirect_to')).toBe('shellui-playground://callback');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('company_id')).toBe('7');
    expect(url.searchParams.get('company_oauth_client_id')).toBe('4');
    expect(url.searchParams.get('provider')).toBe('github');
    expect(url.searchParams.get('code_verifier')).toBeNull();
  });

  test('opens the injected browser and does not put the verifier on the URL', async () => {
    const openUrl = vi.fn();
    configureDesktopAuth({ openUrl });
    await beginDesktopOAuth({
      backendUrl: 'https://auth.example.com',
      companyId: 7,
      provider: 'github',
      scheme: SCHEME,
    });
    expect(openUrl).toHaveBeenCalledTimes(1);
    const opened = String(openUrl.mock.calls[0]?.[0]);
    const url = new URL(opened);
    expect(url.searchParams.get('redirect_to')).toBe('shellui-playground://callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')?.length).toBeGreaterThanOrEqual(43);
    expect(opened).not.toContain('code_verifier');
  });

  test('?error= clears the verifier and emits a message', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    setActiveDesktopScheme(SCHEME);
    const prepared = await createAndStoreDesktopPkce(SCHEME);
    const events: DesktopAuthEvent[] = [];
    subscribeDesktopAuth((event) => events.push(event));

    handleDesktopAuthCallback('shellui-playground://callback?error=unregistered_scheme');

    expect(events).toEqual([
      {
        type: 'error',
        errorCode: 'unregistered_scheme',
        message: 'This desktop scheme is not registered on the OAuth application.',
      },
    ]);
    handleDesktopAuthCallback('shellui-playground://callback?shellui_auth_code=later-code');
    expect(events[events.length - 1]).toMatchObject({
      type: 'error',
      errorCode: 'desktop_signin_expired',
    });
    expect(JSON.stringify(events)).not.toContain(prepared.challenge);
    expect(log).not.toHaveBeenCalled();
  });

  test('exchanges a deep link with the stored verifier once', async () => {
    setActiveDesktopScheme(SCHEME);
    await createAndStoreDesktopPkce(SCHEME);
    const events: DesktopAuthEvent[] = [];
    subscribeDesktopAuth((event) => events.push(event));

    const callback = 'shellui-playground://callback?shellui_auth_code=session-code';
    handleDesktopAuthCallback(callback);
    handleDesktopAuthCallback(callback);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'code',
      authCode: 'session-code',
      redirectTo: 'shellui-playground://callback',
    });
    if (events[0]?.type !== 'code') return;
    expect(events[0].codeVerifier.length).toBeGreaterThanOrEqual(43);
  });

  test('reads the deep-link plugin through Tauri IPC without importing it', async () => {
    const invoke = vi.fn(async (cmd: string) => {
      if (cmd === 'plugin:deep-link|get_current') {
        return ['shellui-playground://callback?shellui_auth_code=from-launch'];
      }
      if (cmd === 'plugin:event|listen') return 4;
      return null;
    });
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: {
        invoke,
        transformCallback: () => 9,
        unregisterCallback: () => undefined,
      },
    });
    setActiveDesktopScheme(SCHEME);
    await createAndStoreDesktopPkce(SCHEME);
    const events: DesktopAuthEvent[] = [];
    subscribeDesktopAuth((event) => events.push(event));

    await ensureDesktopDeepLinkListener();

    expect(invoke).toHaveBeenCalledWith('plugin:deep-link|get_current');
    expect(events[0]).toMatchObject({ type: 'code', authCode: 'from-launch' });
  });

  test('brings the window forward for each sign-in link, even a spent one', async () => {
    const invoke = vi.fn(async (_cmd: string, _args?: Record<string, unknown>) => null);
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: { invoke, metadata: { currentWindow: { label: 'main' } } },
    });
    setActiveDesktopScheme(SCHEME);
    await createAndStoreDesktopPkce(SCHEME);

    const callback = 'shellui-playground://callback?shellui_auth_code=focus-code';
    handleDesktopAuthCallback(callback);
    handleDesktopAuthCallback(callback);
    handleDesktopAuthCallback('other-app://callback?shellui_auth_code=focus-code');
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(6));

    for (const cmd of [
      'plugin:window|unminimize',
      'plugin:window|show',
      'plugin:window|set_focus',
    ]) {
      expect(invoke.mock.calls.filter((call) => call[0] === cmd)).toEqual([
        [cmd, { label: 'main' }],
        [cmd, { label: 'main' }],
      ]);
    }
  });

  test('a login page in an iframe leaves deep links to the top-level shell', async () => {
    const invoke = vi.fn(async () => ['shellui-playground://callback?shellui_auth_code=x']);
    const parent = {};
    vi.stubGlobal('window', {
      parent,
      __TAURI_INTERNALS__: { invoke, transformCallback: () => 9 },
    });
    setActiveDesktopScheme(SCHEME);
    await createAndStoreDesktopPkce(SCHEME);

    await ensureDesktopDeepLinkListener();

    expect(invoke).not.toHaveBeenCalled();
  });
});
