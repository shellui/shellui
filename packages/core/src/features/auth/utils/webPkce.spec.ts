import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { generateCodeChallenge } from './pkce';
import {
  beginShelluiWebMagicLink,
  beginShelluiWebOAuth,
  consumeWebPkce,
  createAndStoreWebPkce,
  shelluiWebMagicLinkRedirectTo,
  shelluiWebOAuthRedirectTo,
  webPkceRedirectKey,
} from './webPkce';

describe('web PKCE', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('stores an S256 verifier and returns it once for the same redirect', async () => {
    const redirectTo = shelluiWebOAuthRedirectTo({
      origin: 'https://app.example.com',
      redirectPath: '/login/callback',
      provider: 'github',
      oauthClientId: 4,
    });
    const { challenge, verifier } = await createAndStoreWebPkce(redirectTo);
    expect(challenge).toBe(await generateCodeChallenge(verifier));
    expect(verifier).not.toBe(challenge);

    const callbackRedirect = `${redirectTo}&shellui_auth_code=one-time`;
    expect(webPkceRedirectKey(callbackRedirect)).toBe(webPkceRedirectKey(redirectTo));
    expect(consumeWebPkce(callbackRedirect)).toBe(verifier);
    expect(consumeWebPkce(callbackRedirect)).toBeNull();
  });

  test('web OAuth start sends code_challenge and the callback exchange can send code_verifier', async () => {
    const startOAuth = vi.fn();
    await beginShelluiWebOAuth({
      origin: 'https://app.example.com',
      provider: 'google',
      redirectPath: '/login/callback?next=%2Fapps',
      startOAuth,
    });

    expect(startOAuth).toHaveBeenCalledTimes(1);
    const challenge = startOAuth.mock.calls[0]?.[3]?.codeChallenge as string;
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]{43,128}$/);
    const redirectTo = shelluiWebOAuthRedirectTo({
      origin: 'https://app.example.com',
      redirectPath: '/login/callback?next=%2Fapps',
      provider: 'google',
    });
    const verifier = consumeWebPkce(redirectTo);
    expect(verifier).toBeTruthy();
    expect(await generateCodeChallenge(verifier as string)).toBe(challenge);
    expect(JSON.stringify(startOAuth.mock.calls[0])).not.toContain(verifier);
  });

  test('web magic link sends code_challenge and clears the verifier when sending fails', async () => {
    const sendMagicLink = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(
      beginShelluiWebMagicLink({
        origin: 'https://app.example.com',
        email: 'ada@acme.com',
        redirectPath: '/login/callback',
        language: 'fr',
        sendMagicLink,
      }),
    ).rejects.toThrow('offline');

    expect(sendMagicLink).toHaveBeenCalledWith('ada@acme.com', '/login/callback', {
      language: 'fr',
      codeChallenge: expect.stringMatching(/^[A-Za-z0-9\-_]{43,128}$/),
    });
    const redirectTo = shelluiWebMagicLinkRedirectTo('https://app.example.com', '/login/callback');
    expect(consumeWebPkce(redirectTo)).toBeNull();
  });

  test('a magic link opened against a different redirect does not receive the verifier', async () => {
    const redirectTo = shelluiWebMagicLinkRedirectTo('https://app.example.com', '/login/callback');
    await createAndStoreWebPkce(redirectTo);
    expect(
      consumeWebPkce(shelluiWebMagicLinkRedirectTo('https://other.example.com', '/login/callback')),
    ).toBeNull();
    expect(consumeWebPkce(redirectTo)).toBeTruthy();
  });
});
