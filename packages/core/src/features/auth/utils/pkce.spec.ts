import { describe, expect, test } from 'vitest';
import { createPkcePair, generateCodeChallenge, generateCodeVerifier } from './pkce';

const UNRESERVED = /^[A-Za-z0-9\-._~]+$/;

describe('PKCE S256', () => {
  test('verifier is 43 unreserved characters and the challenge is its SHA-256', async () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBe(43);
    expect(verifier).toMatch(UNRESERVED);

    const challenge = await generateCodeChallenge(verifier);
    expect(challenge.length).toBe(43);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toMatch(/[=+/]/);

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    expect(challenge).toBe(expected);
  });

  test('two sign-in attempts do not reuse the verifier', async () => {
    const first = await createPkcePair();
    const second = await createPkcePair();
    expect(first.verifier).not.toBe(second.verifier);
    expect(first.challenge).not.toBe(second.challenge);
    expect(first.challenge).not.toBe(first.verifier);
  });

  test('rejects a verifier outside the identity-service length', async () => {
    await expect(generateCodeChallenge('short')).rejects.toThrow(/43 to 128/);
  });
});
