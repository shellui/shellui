import type { IconType } from 'react-icons';
import {
  FaApple,
  FaFacebook,
  FaGithub,
  FaGoogle,
  FaLinkedinIn,
  FaMicrosoft,
  FaQuestion,
  FaXTwitter,
} from 'react-icons/fa6';

export type ProviderVisual = {
  Icon: IconType;
  iconClassName: string;
  badgeClassName: string;
};

/**
 * Returns lightweight visual metadata used to style provider buttons.
 */
export const getProviderVisual = (provider: string): ProviderVisual => {
  switch (provider.toLowerCase()) {
    case 'apple':
      return {
        Icon: FaApple,
        iconClassName: 'text-black dark:text-white',
        badgeClassName: 'bg-muted',
      };
    case 'google':
      return {
        Icon: FaGoogle,
        iconClassName: 'text-[#DB4437] dark:text-[#F28B82]',
        badgeClassName: 'bg-[#DB4437]/10 dark:bg-[#DB4437]/20',
      };
    case 'github':
      return {
        Icon: FaGithub,
        iconClassName: 'text-[#24292F] dark:text-white',
        badgeClassName: 'bg-muted',
      };
    case 'microsoft':
      return {
        Icon: FaMicrosoft,
        iconClassName: 'text-[#0078D4] dark:text-[#5BB8FF]',
        badgeClassName: 'bg-[#0078D4]/10 dark:bg-[#0078D4]/20',
      };
    case 'meta':
    case 'facebook':
      return {
        Icon: FaFacebook,
        iconClassName: 'text-[#1877F2] dark:text-[#60A5FA]',
        badgeClassName: 'bg-[#1877F2]/10 dark:bg-[#1877F2]/20',
      };
    case 'x':
    case 'twitter':
      return {
        Icon: FaXTwitter,
        iconClassName: 'text-black dark:text-white',
        badgeClassName: 'bg-muted',
      };
    case 'linkedin':
    case 'linkedin_oidc':
      return {
        Icon: FaLinkedinIn,
        iconClassName: 'text-[#0A66C2] dark:text-[#60A5FA]',
        badgeClassName: 'bg-[#0A66C2]/10 dark:bg-[#0A66C2]/20',
      };
    default:
      return {
        Icon: FaQuestion,
        iconClassName: 'text-primary',
        badgeClassName: 'bg-primary/10 dark:bg-primary/20',
      };
  }
};
