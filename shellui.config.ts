import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'ShellUI',
  // Enable specific languages: single language string or array of language codes
  // Examples:
  // language: 'en',           // Only English
  // language: ['en', 'fr'],  // English and French
  // language: ['fr'],         // Only French
  language: ['en', 'fr'], // Enable both English and French
  // Custom themes - register additional themes beyond the default ones
  themes: [
    {
      name: 'purple',
      displayName: 'Purple',
      colors: {
        light: {
          background: '#FFFFFF', // White
          foreground: '#020617', // Very dark blue-gray
          card: '#FFFFFF', // White
          cardForeground: '#020617', // Very dark blue-gray
          popover: '#FFFFFF', // White
          popoverForeground: '#020617', // Very dark blue-gray
          primary: '#A855F7', // Purple
          primaryForeground: '#F8FAFC', // Off-white
          secondary: '#F1F5F9', // Light gray-blue
          secondaryForeground: '#0F172A', // Dark blue-gray
          muted: '#F1F5F9', // Light gray-blue
          mutedForeground: '#64748B', // Medium gray-blue
          accent: '#F1F5F9', // Light gray-blue
          accentForeground: '#0F172A', // Dark blue-gray
          destructive: '#EF4444', // Red
          destructiveForeground: '#F8FAFC', // Off-white
          border: '#E2E8F0', // Light gray
          input: '#E2E8F0', // Light gray
          ring: '#A855F7', // Purple
          radius: '0.5rem',
          sidebarBackground: '#FAFAFA', // Off-white
          sidebarForeground: '#334155', // Dark gray-blue
          sidebarPrimary: '#A855F7', // Purple
          sidebarPrimaryForeground: '#FFFFFF', // White
          sidebarAccent: '#F4F4F5', // Light gray
          sidebarAccentForeground: '#0F172A', // Very dark blue-gray
          sidebarBorder: '#E2E8F0', // Light gray
          sidebarRing: '#A855F7', // Purple
        },
        dark: {
          background: '#020617', // Very dark blue-gray
          foreground: '#F8FAFC', // Off-white
          card: '#020617', // Very dark blue-gray
          cardForeground: '#F8FAFC', // Off-white
          popover: '#020617', // Very dark blue-gray
          popoverForeground: '#F8FAFC', // Off-white
          primary: '#A855F7', // Purple
          primaryForeground: '#0F172A', // Dark blue-gray
          secondary: '#1E293B', // Dark blue-gray
          secondaryForeground: '#F8FAFC', // Off-white
          muted: '#1E293B', // Dark blue-gray
          mutedForeground: '#94A3B8', // Medium gray-blue
          accent: '#1E293B', // Dark blue-gray
          accentForeground: '#F8FAFC', // Off-white
          destructive: '#991B1B', // Dark red
          destructiveForeground: '#F8FAFC', // Off-white
          border: '#1E293B', // Dark blue-gray
          input: '#1E293B', // Dark blue-gray
          ring: '#A855F7', // Purple
          radius: '0.5rem',
          sidebarBackground: '#0F172A', // Very dark blue-gray
          sidebarForeground: '#F1F5F9', // Light gray-blue
          sidebarPrimary: '#A855F7', // Purple
          sidebarPrimaryForeground: '#0F172A', // Dark blue-gray
          sidebarAccent: '#18181B', // Very dark gray
          sidebarAccentForeground: '#F1F5F9', // Light gray-blue
          sidebarBorder: '#18181B', // Very dark gray
          sidebarRing: '#A855F7', // Purple
        },
      },
    },
  ],
  navigation: [
    {
      // Simple string label (backward compatible)
      label: 'Playground',
      path: 'playground',
      url: '/',
      icon: "/icons/play.svg"
    },
    {
      // Language-specific label (new feature)
      label: {
        en: 'Docs',
        fr: 'Documentation'
      },
      path: 'docs',
      url: 'http://localhost:3000',
      icon: '/icons/book-open.svg'
    },
    {
      label: 'ShellUI',
      path: 'shellui',
      url: 'https://shellui.com/',
      icon: "/icons/user.svg"
    },
    {
      label: 'Sebastienbarbier',
      path: 'sebastienbarbier',
      url: 'https://sebastienbarbier.com/'
    },
    {
      // Group title can also be localized
      title: {
        en: 'System',
        fr: 'Système'
      },
      items: [
        {
          label: {
            en: 'Page not found',
            fr: 'Page non trouvée'
          },
          path: '404',
          url: '/thisisnotfound'
        },
        {
          label: {
            en: 'Settings',
            fr: 'Paramètres'
          },
          path: 'settings',
          url: '/__settings',
          icon: '/icons/settings.svg'
        }
      ]
    }
  ]
};

export default config;
