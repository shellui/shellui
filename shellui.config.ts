import { type ShellUIConfig } from '@shellui/core';

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
      name: 'sebastienbarbier',
      displayName: 'sebastienbarbier.com',
      // Load Google Fonts for Open Sans and Source Serif
      fontFiles: [
        'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&family=Source+Serif+Pro:wght@400;600;700&display=swap',
      ],
      // Serif for headings, sans-serif for body
      headingFontFamily: '"Source Serif Pro", Georgia, serif',
      bodyFontFamily: '"Open Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      lineHeight: '1.6',
      letterSpacing: '0.01em',
      colors: {
        light: {
          background: '#F8F5F2', // Warm beige/cream background (from sebastienbarbier.com)
          foreground: '#202124', // Dark gray text (on-background)
          card: '#F2EDEA', // Surface color - slightly lighter beige
          cardForeground: '#202124', // Dark gray text
          popover: '#F2EDEA', // Surface color
          popoverForeground: '#202124', // Dark gray text
          primary: '#1F1D1D', // Very dark gray (almost black) - primary color
          primaryForeground: '#E8EAED', // Light gray (on-primary)
          secondary: '#A37200', // Gold/brown accent color
          secondaryForeground: '#FFF9EB', // Very light cream (on-secondary)
          muted: '#F2EDEA', // Surface color for muted elements
          mutedForeground: '#5F5959', // Medium gray (grey-16 from palette)
          accent: '#DBB778', // Light gold (secondary-variant)
          accentForeground: '#202124', // Dark gray
          destructive: '#DC2626', // Red
          destructiveForeground: '#FFFFFF', // White
          border: '#D7D5D5', // Light gray border (grey-4 from palette)
          input: '#D7D5D5', // Light gray input border
          ring: '#A37200', // Gold ring color
          radius: '0.375rem', // Slightly smaller radius for cleaner look
          sidebarBackground: '#F2EDEA', // Surface color
          sidebarForeground: '#202124', // Dark gray text
          sidebarPrimary: '#1F1D1D', // Very dark gray
          sidebarPrimaryForeground: '#E8EAED', // Light gray
          sidebarAccent: '#F8F5F2', // Background color for accent
          sidebarAccentForeground: '#202124', // Dark gray
          sidebarBorder: '#D7D5D5', // Light gray border
          sidebarRing: '#A37200', // Gold ring
        },
        dark: {
          background: '#1F1D1D', // Very dark gray (primary color becomes background)
          foreground: '#E8EAED', // Light gray (on-primary becomes foreground)
          card: '#2A2828', // Slightly lighter dark gray (grey-21)
          cardForeground: '#E8EAED', // Light gray
          popover: '#2A2828', // Slightly lighter dark gray
          popoverForeground: '#E8EAED', // Light gray
          primary: '#DBB778', // Light gold (secondary-variant becomes primary in dark)
          primaryForeground: '#202124', // Dark gray
          secondary: '#A37200', // Gold/brown accent (same as light)
          secondaryForeground: '#FFF9EB', // Very light cream
          muted: '#2A2828', // Dark gray
          mutedForeground: '#9C9696', // Medium gray (grey-10)
          accent: '#A37200', // Gold accent
          accentForeground: '#FFF9EB', // Very light cream
          destructive: '#EF4444', // Red
          destructiveForeground: '#FFFFFF', // White
          border: '#3F3B3B', // Medium dark gray border (grey-19)
          input: '#3F3B3B', // Medium dark gray input border
          ring: '#DBB778', // Light gold ring
          radius: '0.375rem', // Slightly smaller radius for cleaner look
          sidebarBackground: '#1F1D1D', // Very dark gray
          sidebarForeground: '#E8EAED', // Light gray text
          sidebarPrimary: '#DBB778', // Light gold
          sidebarPrimaryForeground: '#202124', // Dark gray
          sidebarAccent: '#2A2828', // Dark gray accent
          sidebarAccentForeground: '#E8EAED', // Light gray
          sidebarBorder: '#2A2828', // Dark gray border
          sidebarRing: '#DBB778', // Light gold ring
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
          url: '/thisisnotfound',
          hidden: true
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
