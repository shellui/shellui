/**
 * PKCE S256 (RFC 7636). The verifier stays in the app. Only the challenge is sent.
 * 32 random bytes encode to 43 base64url characters, inside the 43-128 range.
 */

const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64UrlEncode(bytes);
  if (!VERIFIER_PATTERN.test(verifier)) {
    throw new Error('Could not generate a PKCE verifier.');
  }
  return verifier;
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  if (!VERIFIER_PATTERN.test(verifier)) {
    throw new Error('PKCE verifier must be 43 to 128 unreserved characters.');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  return { verifier, challenge };
}
