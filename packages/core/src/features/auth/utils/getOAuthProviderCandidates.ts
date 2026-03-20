/**
 * Expands a provider key into canonical aliases accepted by different backends.
 */
export const getOAuthProviderCandidates = (provider: string): string[] => {
  const normalized = provider.toLowerCase();
  const aliases: Record<string, string[]> = {
    x: ['x', 'twitter'],
    twitter: ['twitter', 'x'],
    meta: ['meta', 'facebook'],
    facebook: ['facebook', 'meta'],
    linkedin: ['linkedin', 'linkedin_oidc'],
    linkedin_oidc: ['linkedin_oidc', 'linkedin'],
  };
  return aliases[normalized] ?? [normalized];
};
