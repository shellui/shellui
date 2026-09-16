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
        {
          type: 'doc',
          id: 'installation',
          label: 'Installation',
        },
        {
          type: 'doc',
          id: 'quickstart',
          label: 'Create a Project',
        },
        {
          type: 'doc',
          id: 'framework-starters',
          label: 'Framework Starters',
        },
        {
          type: 'doc',
          id: 'backend',
          label: 'Backend',
        },
        {
          type: 'doc',
          id: 'features/authentication',
          label: 'Authentication',
        },
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
            {
              type: 'doc',
              id: 'features/navigation',
              label: 'Navigation',
            },
            {
              type: 'doc',
              id: 'features/layouts',
              label: 'Layouts',
            },
            {
              type: 'doc',
              id: 'features/modals-drawers',
              label: 'Modals & Drawers',
            },
          ],
        },
        {
          type: 'category',
          label: 'Customization',
          collapsed: false,
          items: [
            {
              type: 'doc',
              id: 'features/themes',
              label: 'Themes',
            },
            {
              type: 'doc',
              id: 'features/internationalization',
              label: 'Internationalization',
            },
          ],
        },
        {
          type: 'category',
          label: 'User Interface',
          collapsed: false,
          items: [
            {
              type: 'doc',
              id: 'features/toasts',
              label: 'Toasts',
            },
            {
              type: 'doc',
              id: 'features/dialogs',
              label: 'Dialogs',
            },
            {
              type: 'doc',
              id: 'features/chrome-actions',
              label: 'Floating chrome actions',
            },
          ],
        },
        {
          type: 'category',
          label: 'Advanced',
          collapsed: false,
          items: [
            {
              type: 'doc',
              id: 'features/administration',
              label: 'Administration',
            },
            {
              type: 'doc',
              id: 'features/storage',
              label: 'Storage',
            },
            {
              type: 'doc',
              id: 'features/storage-picker',
              label: 'Storage Picker',
            },
            {
              type: 'doc',
              id: 'features/application-settings',
              label: 'Application Settings',
            },
            {
              type: 'doc',
              id: 'features/cookie-consent',
              label: 'Cookie Consent',
            },
            {
              type: 'doc',
              id: 'features/legal-documents',
              label: 'Legal Documents',
            },
            {
              type: 'doc',
              id: 'features/service-worker',
              label: 'Service Worker',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'cli',
          label: 'CLI',
        },
        {
          type: 'doc',
          id: 'core',
          label: 'Core',
        },
        {
          type: 'doc',
          id: 'sdk',
          label: 'SDK',
        },
        {
          type: 'doc',
          id: 'tauri',
          label: 'Desktop App',
        },
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'development',
          label: 'Development',
        },
        {
          type: 'doc',
          id: 'publishing',
          label: 'Publishing',
        },
        {
          type: 'doc',
          id: 'sentry',
          label: 'Sentry',
        },
        {
          type: 'doc',
          id: 'adr/ai-skill',
          label: 'ADR 0001',
        },
      ],
    },
  ],
};

module.exports = sidebars;
