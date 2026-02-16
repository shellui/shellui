import { type ShellUIConfig } from '@shellui/core';
import urls from '@shellui/core/constants/urls';
import { getVersion } from './scripts/get-version.js';

const config: ShellUIConfig = {
  port: 4000,
  title: 'shellui',
  version: getVersion(),
  favicon: '/favicon.svg',
  logo: '/logo.svg',
  // Cookie consent: register cookies by host; accepted hosts stored in settings. Use host to gate features (e.g. getCookieConsentAccepted('sentry.io')).
  // consentedCookieHosts records which hosts were in config at last consent so we can detect new cookies and re-prompt while keeping existing approvals.
  cookieConsent: {
    cookies: [
      {
        name: 'Sentry Error Reporting',
        host: 'sentry.io',
        durationSeconds: 31536000, // 1 year
        type: 'third_party',
        category: 'functional_performance',
        description: {
          en: 'Helps us fix errors and improve stability.',
          fr: 'Nous aide à corriger les erreurs et à améliorer la stabilité.',
        },
      },
    ],
  },
  // Layout: 'sidebar' (default), 'fullscreen' (content only), 'windows' (taskbar + multi-window), or 'app-bar' (top bar)
  layout: 'sidebar',
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
      // Local fonts from static/fonts/ (Open Sans, Source Serif 4)
      fontFiles: ['/fonts/fonts.css'],
      // Serif for headings, sans-serif for body
      headingFontFamily: '"Source Serif 4", Georgia, serif',
      bodyFontFamily:
        '"Open Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
      icon: '/icons/play.svg',
      position: 'end',
    },
    {
      label: 'Home',
      path: '',
      // url: 'http://localhost:5173/#/',
      url: 'https://docs.shellui.com',
    },
    {
      title: 'Playground',
      items: [
        {
          label: 'Home',
          path: 'home',
          url: 'http://localhost:5173/#/',
        },
        {
          label: 'Themes',
          path: 'themes',
          url: 'http://localhost:5173/#/themes',
          settings: 'http://localhost:5173/#/themes',
        },
        {
          label: 'Home with Subpath',
          path: 'root',
          url: 'http://localhost:5173/#/',
        },
      ],
    },
    {
      // Language-specific label (new feature)
      label: {
        en: 'Docs',
        fr: 'Documentation',
      },
      path: 'docs',
      url: 'https://docs.shellui.com',
      icon: '/icons/book-open.svg',
    },
    {
      label: 'ShellUI',
      path: 'shellui',
      url: 'https://shellui.com/',
      icon: '/icons/user.svg',
    },
    {
      // Group title can also be localized
      title: {
        en: 'System',
        fr: 'Système',
      },
      items: [
        {
          label: {
            en: 'Page not found',
            fr: 'Page non trouvée',
          },
          path: '404',
          url: '/thisisnotfound',
          hidden: true,
        },
        {
          label: {
            en: 'Settings',
            fr: 'Paramètres',
          },
          path: 'settings',
          url: urls.settings,
          icon: '/icons/settings.svg',
        },
      ],
    },
    {
      label: {
        en: 'Settings',
        fr: 'Paramètres',
      },
      path: 'settings',
      url: urls.settings,
      icon: '/icons/settings.svg',
      openIn: 'modal',
      position: 'end',
      hiddenOnMobile: true,
    },
  ],
};

export default config;
