import { describe, expect, it, vi } from 'vitest';
import {
  SILENT_AUTH_RESULT_TYPE,
  buildSilentAuthorizeUrl,
  publishSilentAuthCallbackResult,
  readSilentAuthMessage,
  runSilentPkceSignIn,
  type SilentAuthFrame,
  type SilentAuthHost,
} from './silentSignIn';

describe('buildSilentAuthorizeUrl', () => {
  it('uses PKCE, prompt=none, and code delivery without a shell token', () => {
    const shellToken = 'shell-access-token.should.not.appear';
    const url = new URL(
      buildSilentAuthorizeUrl({
        backendUrl: 'https://id.other.example/',
        provider: 'google',
        redirectTo:
          'https://shell.example/login/callback?shellui_silent=1&shellui_silent_state=abc',
        codeChallenge: 'challenge-value',
        companyId: 4,
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe('https://id.other.example/api/v1/authorize');
    expect(url.searchParams.get('prompt')).toBe('none');
    expect(url.searchParams.get('token_delivery')).toBe('code');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('company_id')).toBe('4');
    expect(url.searchParams.get('code_verifier')).toBeNull();
    expect(url.searchParams.get('access_token')).toBeNull();
    expect(url.toString()).not.toContain(shellToken);
  });
});

describe('readSilentAuthMessage', () => {
  const source = { id: 'frame' };
  const expected = { origin: 'https://shell.example', source, state: 'state-1' };

  it('accepts a matching code from the opened frame', () => {
    expect(
      readSilentAuthMessage(
        {
          origin: 'https://shell.example',
          source,
          data: { type: SILENT_AUTH_RESULT_TYPE, state: 'state-1', authCode: 'one-time' },
        },
        expected,
      ),
    ).toEqual({ ok: true, authCode: 'one-time' });
  });

  it('rejects a wildcard origin, a different source, and a different state', () => {
    const data = { type: SILENT_AUTH_RESULT_TYPE, state: 'state-1', authCode: 'one-time' };
    expect(
      readSilentAuthMessage({ origin: '*', source, data }, { ...expected, origin: '*' }),
    ).toBeNull();
    expect(
      readSilentAuthMessage({ origin: 'https://evil.example', source, data }, expected),
    ).toBeNull();
    expect(
      readSilentAuthMessage(
        { origin: 'https://shell.example', source: { id: 'other' }, data },
        expected,
      ),
    ).toBeNull();
    expect(
      readSilentAuthMessage(
        {
          origin: 'https://shell.example',
          source,
          data: { type: SILENT_AUTH_RESULT_TYPE, state: 'other', authCode: 'one-time' },
        },
        expected,
      ),
    ).toBeNull();
  });
});

describe('publishSilentAuthCallbackResult', () => {
  it('posts to the same origin and never to *', () => {
    const postMessage = vi.fn();
    const parent = { location: { origin: 'https://shell.example' }, postMessage };
    const win = {
      parent,
      location: {
        origin: 'https://shell.example',
        search: '?shellui_silent=1&shellui_silent_state=abc&shellui_auth_code=one-time',
      },
    } as unknown as Window;

    expect(publishSilentAuthCallbackResult(win)).toBe(true);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][1]).toBe('https://shell.example');
    expect(postMessage.mock.calls[0][1]).not.toBe('*');
    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: SILENT_AUTH_RESULT_TYPE,
      state: 'abc',
      authCode: 'one-time',
    });
  });

  it('does not post the code to a cross-origin parent', () => {
    const postMessage = vi.fn();
    const parent = { postMessage };
    Object.defineProperty(parent, 'location', {
      get() {
        throw new Error('cross-origin');
      },
    });
    const win = {
      parent,
      location: {
        origin: 'https://shell.example',
        search: '?shellui_silent=1&shellui_silent_state=abc&shellui_auth_code=one-time',
      },
    } as unknown as Window;

    expect(publishSilentAuthCallbackResult(win)).toBe(true);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('ignores a top-level window', () => {
    const win = {
      location: {
        origin: 'https://shell.example',
        search: '?shellui_silent=1&shellui_silent_state=abc',
      },
    } as unknown as Window;
    (win as { parent: Window }).parent = win;
    expect(publishSilentAuthCallbackResult(win)).toBe(false);
  });
});

describe('runSilentPkceSignIn', () => {
  function host(): SilentAuthHost & {
    frame: SilentAuthFrame;
    src: () => string;
    deliver: (event: { origin: string; source: unknown; data: unknown }) => void;
  } {
    const frame: SilentAuthFrame = { contentWindow: { id: 'frame' }, remove: vi.fn() };
    let deliver = (_event: { origin: string; source: unknown; data: unknown }) => {};
    let src = '';
    return {
      frame,
      origin: 'https://shell.example',
      callbackPath: '/login/callback',
      timeoutMs: 50,
      src: () => src,
      deliver: (event) => deliver(event),
      createFrame(next) {
        src = next;
        return frame;
      },
      listen(fn) {
        deliver = fn;
        return () => {};
      },
    };
  }

  it('returns the code and verifier for a matching frame message', async () => {
    const silent = host();
    const pending = runSilentPkceSignIn(
      { backendUrl: 'https://id.other.example', provider: 'google', companyId: 4 },
      silent,
    );
    await vi.waitUntil(() => silent.src() !== '');
    const authorize = new URL(silent.src());
    const redirect = new URL(authorize.searchParams.get('redirect_to') ?? '');
    const state = redirect.searchParams.get('shellui_silent_state') ?? '';
    expect(authorize.searchParams.get('prompt')).toBe('none');
    expect(authorize.toString()).not.toContain('code_verifier');

    silent.deliver({
      origin: 'https://evil.example',
      source: silent.frame.contentWindow,
      data: { type: SILENT_AUTH_RESULT_TYPE, state, authCode: 'stolen' },
    });
    silent.deliver({
      origin: 'https://shell.example',
      source: silent.frame.contentWindow,
      data: { type: SILENT_AUTH_RESULT_TYPE, state, authCode: 'one-time' },
    });

    const outcome = await pending;
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.authCode).toBe('one-time');
    expect(outcome.redirectTo).toBe(redirect.toString());
    expect(outcome.codeVerifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
    expect(authorize.toString()).not.toContain(outcome.codeVerifier);
    expect(silent.frame.remove).toHaveBeenCalled();
  });

  it('times out without a result', async () => {
    const silent = host();
    const outcome = await runSilentPkceSignIn(
      { backendUrl: 'https://id.other.example', provider: 'google' },
      silent,
    );
    expect(outcome).toEqual({ ok: false, reason: 'timeout' });
    expect(silent.frame.remove).toHaveBeenCalled();
  });
});
