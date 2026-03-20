export type ProviderVisual = {
  iconText: string;
  iconClassName: string;
};

/**
 * Returns lightweight visual metadata used to style provider buttons.
 */
export const getProviderVisual = (provider: string): ProviderVisual => {
  switch (provider.toLowerCase()) {
    case 'apple':
      return { iconText: 'A', iconClassName: 'bg-black text-white' };
    case 'google':
      return { iconText: 'G', iconClassName: 'bg-[#4285F4] text-white' };
    case 'github':
      return { iconText: 'GH', iconClassName: 'bg-[#24292F] text-white' };
    case 'microsoft':
      return { iconText: 'MS', iconClassName: 'bg-[#00A4EF] text-white' };
    case 'meta':
    case 'facebook':
      return { iconText: 'M', iconClassName: 'bg-[#1877F2] text-white' };
    case 'x':
    case 'twitter':
      return { iconText: 'X', iconClassName: 'bg-black text-white' };
    case 'linkedin':
    case 'linkedin_oidc':
      return { iconText: 'in', iconClassName: 'bg-[#0A66C2] text-white' };
    default:
      return {
        iconText: provider.slice(0, 1).toUpperCase(),
        iconClassName: 'bg-primary text-primary-foreground',
      };
  }
};
