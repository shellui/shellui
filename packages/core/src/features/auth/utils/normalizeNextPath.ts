import urls from '../../../constants/urls';

/**
 * Sanitizes "next" redirect paths to prevent invalid or unsafe redirects.
 */
export const normalizeNextPath = (value: string | null): string | null => {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value === urls.login || value.startsWith(`${urls.login}?`)) return null;
  return value;
};
