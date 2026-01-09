import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'ShellUI',
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
      url: 'http://localhost:4000/'
    },
    {
      label: 'Sebastienbarbier',
      path: 'sebastienbarbier',
      url: 'https://sebastienbarbier.com/'
    }
  ]
};

export default config;
