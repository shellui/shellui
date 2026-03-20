/**
 * Maps UI provider keys to the preferred backend provider identifier.
 */
export const getPreferredBackendProvider = (provider: string): string => {
  const normalized = provider.toLowerCase();
  if (normalized === 'x') return 'twitter';
  if (normalized === 'meta') return 'facebook';
  if (normalized === 'linkedin') return 'linkedin_oidc';
  return normalized;
};
