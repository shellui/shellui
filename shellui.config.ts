import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'ShellUI',
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
