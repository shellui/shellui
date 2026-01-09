import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'ShellUI',
  settingsUrl: '/settings',
  navigation: [
    {
      label: 'Docs',
      path: 'docs',
      url: 'https://docs.shellui.com/',
      icon: '/icons/book-open.svg'
    },
    {
      label: 'Playground',
      path: 'playground',
      url: 'http://localhost:4000/',
      icon: "/icons/play.svg"
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
      label: 'Settings',
      path: 'settings2',
      url: '/settings',
      icon: '/icons/settings.svg'
    }
  ]
};

export default config;
