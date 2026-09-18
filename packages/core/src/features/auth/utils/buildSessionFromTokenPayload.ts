import type { AuthSession } from '../types';
import { buildSessionFromParams } from './buildSessionFromParams';

export const tokenPayloadToUrlParams = (
  payload: Record<string, unknown> | null | undefined,
): URLSearchParams => {
  const params = new URLSearchParams();
  if (!payload) return params;
  if (typeof payload.access_token === 'string') params.set('access_token', payload.access_token);
  if (typeof payload.refresh_token === 'string') params.set('refresh_token', payload.refresh_token);
  if (typeof payload.expires_at === 'number' || typeof payload.expires_at === 'string') {
    params.set('expires_at', String(payload.expires_at));
  }
  if (typeof payload.expires_in === 'number' || typeof payload.expires_in === 'string') {
    params.set('expires_in', String(payload.expires_in));
  }
  if (typeof payload.token_type === 'string') params.set('token_type', payload.token_type);
  return params;
};

export const buildSessionFromTokenPayload = (
  payload: Record<string, unknown> | null | undefined,
  nowSeconds: number,
): AuthSession | null => buildSessionFromParams(tokenPayloadToUrlParams(payload), nowSeconds);
