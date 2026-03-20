/**
 * Converts an OAuth provider key into a user-facing display label.
 */
export const formatProviderLabel = (provider: string): string => {
  const key = provider.toLowerCase();
  if (key === 'github') return 'GitHub';
  if (key === 'x' || key === 'twitter') return 'X';
  if (key === 'meta' || key === 'facebook') return 'Meta';
  if (key === 'linkedin' || key === 'linkedin_oidc') return 'LinkedIn';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};
