import { buildSessionFromTokenPayload } from '../utils/buildSessionFromTokenPayload';
import type { AuthSession } from '../types';

export const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
export const ACCESS_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';

export type TokenExchangeOutcome =
  | { ok: true; session: AuthSession }
  | { ok: false; reason: string };

/**
 * RFC 8693 token exchange against a regional identity server.
 * The shell access token goes to that server only. Never pass it to a child app.
 */
export async function exchangeShellTokenForAppSession(input: {
  backendUrl: string;
  companyId?: string | number;
  shellAccessToken: string;
  nowSeconds: number;
}): Promise<TokenExchangeOutcome> {
  const companyId = `${input.companyId ?? ''}`.trim();
  if (!/^\d+$/.test(companyId)) return { ok: false, reason: 'missing_company_id' };
  if (!input.shellAccessToken) return { ok: false, reason: 'no_shell_session' };

  const body = new URLSearchParams({
    grant_type: TOKEN_EXCHANGE_GRANT,
    subject_token: input.shellAccessToken,
    subject_token_type: ACCESS_TOKEN_TYPE,
    company_id: companyId,
  });
  let response: Response;
  try {
    response = await fetch(`${input.backendUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      credentials: 'omit',
    });
  } catch {
    return { ok: false, reason: 'token_exchange_unreachable' };
  }
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    if (response.status === 404) return { ok: false, reason: 'token_exchange_unavailable' };
    const code = typeof payload?.error === 'string' ? payload.error : `http_${response.status}`;
    const detail =
      typeof payload?.error_description === 'string' ? payload.error_description.slice(0, 200) : '';
    return { ok: false, reason: detail ? `${code}: ${detail}` : code };
  }
  const session = buildSessionFromTokenPayload(payload, input.nowSeconds);
  if (!session?.accessToken) return { ok: false, reason: 'token_exchange_empty' };
  return { ok: true, session };
}

const HINTS: Record<string, string> = {
  missing_company_id:
    'Set the regional company id (regional_company_id) as companyId on this app backend.',
  no_shell_session: 'The shell has no session access token to exchange. Sign in to the shell.',
  token_exchange_unreachable:
    'The regional identity server did not answer. Check its URL and that OIDC_CORS_ALLOWED_ORIGINS lists this shell origin.',
  token_exchange_unavailable:
    'The regional identity server does not offer token exchange. It needs role region, GLOBAL_ISSUER_URL, GLOBAL_JWKS and GLOBAL_ACCESS_TOKEN_AUDIENCE.',
  invalid_request:
    'The regional identity server refused the request. Check OIDC_CORS_ALLOWED_ORIGINS lists this shell origin.',
  invalid_target: 'The regional identity server does not know this company id.',
  invalid_grant:
    'The regional identity server refused the shell token or this user for that company.',
};

export function describeAppSessionFailure(reason: string): string | undefined {
  const code = reason.split(':')[0].trim();
  return HINTS[code];
}
