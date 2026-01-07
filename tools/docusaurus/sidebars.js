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
      items: [
        'quickstart',
        'installation',
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      items: [
        'cli',
        'core',
        'sdk',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'development',
        'publishing',
      ],
    },
  ],
};

module.exports = sidebars;


