/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or here explicitly.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').Config} */
const sidebars = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  tutorialSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'installation',
        'quickstart',
        'backend',
        'features/authentication',
      ],
    },
    {
      type: 'category',
      label: 'Features',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Navigation & Layout',
          collapsed: false,
          items: [
            'features/navigation',
            'features/layouts',
            'features/modals-drawers',
          ],
        },
        {
          type: 'category',
          label: 'Customization',
          collapsed: false,
          items: [
            'features/themes',
            'features/internationalization',
          ],
        },
        {
          type: 'category',
          label: 'User Interface',
          collapsed: false,
          items: [
            'features/toasts',
            'features/dialogs',
          ],
        },
        {
          type: 'category',
          label: 'Advanced',
          collapsed: false,
          items: [
            'features/administration',
            'features/storage',
            'features/storage-picker',
            'features/application-settings',
            'features/cookie-consent',
            'features/legal-documents',
            'features/service-worker',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      collapsed: false,
      items: [
        'cli',
        'core',
        'sdk',
        'tauri',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        'development',
        'publishing',
      ],
    },
  ],
};

module.exports = sidebars;
