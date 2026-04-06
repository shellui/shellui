import type { AuthSession, UserPreferences } from '../types';
import { decodeJwtPayload, normalizeJwtUserGroups } from './decodeJwtPayload';

// Builds an AuthSession from callback or refresh URL parameters.
export const buildSessionFromParams = (
  params: URLSearchParams,
  nowSeconds: number,
): AuthSession | null => {
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  const expiresAtFromParam = Number(params.get('expires_at'));
  const expiresInFromParam = Number(params.get('expires_in'));
  const expiresAt =
    Number.isFinite(expiresAtFromParam) && expiresAtFromParam > 0
      ? expiresAtFromParam
      : Number.isFinite(expiresInFromParam) && expiresInFromParam > 0
        ? nowSeconds + expiresInFromParam
        : nowSeconds + 3600;

  const tokenType = params.get('token_type') ?? 'bearer';
  const payload = decodeJwtPayload(accessToken);
  const appMetadata =
    payload?.app_metadata && typeof payload.app_metadata === 'object'
      ? (payload.app_metadata as Record<string, unknown>)
      : null;
  const userMetadata =
    payload?.user_metadata && typeof payload.user_metadata === 'object'
      ? (payload.user_metadata as Record<string, unknown>)
      : null;
  const rawPreferences =
    userMetadata?.shelluiPreferences && typeof userMetadata.shelluiPreferences === 'object'
      ? (userMetadata.shelluiPreferences as Record<string, unknown>)
      : null;
  const preferences: UserPreferences | null = rawPreferences
    ? {
        ...(typeof rawPreferences.themeName === 'string'
          ? { themeName: rawPreferences.themeName }
          : {}),
        ...(rawPreferences.language === 'en' || rawPreferences.language === 'fr'
          ? { language: rawPreferences.language as 'en' | 'fr' }
          : {}),
        ...(typeof rawPreferences.region === 'string' ? { region: rawPreferences.region } : {}),
        ...(rawPreferences.colorScheme === 'light' ||
        rawPreferences.colorScheme === 'dark' ||
        rawPreferences.colorScheme === 'system'
          ? { colorScheme: rawPreferences.colorScheme as 'light' | 'dark' | 'system' }
          : {}),
      }
    : null;
  const userId =
    typeof payload?.sub === 'string'
      ? payload.sub
      : typeof payload?.user_id === 'string'
        ? payload.user_id
        : null;

  return {
    accessToken,
    refreshToken,
    tokenType,
    expiresAt,
    provider: typeof appMetadata?.provider === 'string' ? appMetadata.provider : null,
    userId,
    userEmail: typeof payload?.email === 'string' ? payload.email : null,
    userName:
      typeof userMetadata?.full_name === 'string'
        ? userMetadata.full_name
        : typeof userMetadata?.name === 'string'
          ? userMetadata.name
          : null,
    userAvatarUrl: typeof userMetadata?.avatar_url === 'string' ? userMetadata.avatar_url : null,
    userIsStaff: userMetadata?.is_staff === true,
    userIsCompanyOwner: userMetadata?.is_company_owner === true,
    userPreferences: preferences,
    userGroups: normalizeJwtUserGroups(userMetadata?.groups),
  };
};
