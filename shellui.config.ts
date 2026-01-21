import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'ShellUI',
  navigation: [
    {
      label: 'Playground',
      path: 'playground',
      url: '/',
      icon: "/icons/play.svg"
    },
    {
      label: 'Docs',
      path: 'docs',
      url: 'https://docs.shellui.com/',
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
      title: 'System',
      items: [
        {
          label: 'Page not found',
          path: '404',
          url: '/thisisnotfound'
        },
        {
          label: 'Settings',
          path: 'settings',
          url: '/__settings',
          icon: '/icons/settings.svg'
        }
      ]
    }
  ]
};

export default config;
