// @ts-check
// Sidebar for docs.shellui.com/hosting. The central site in shellui/shellui
// (tools/docusaurus) loads this file. Doc ids are file names in this folder.

/**
 * @param {string} label
 * @param {Array<string | {type: 'doc', id: string, label: string}>} items
 */
const category = (label, items) => ({
  type: /** @type {const} */ ('category'),
  label,
  collapsible: true,
  collapsed: false,
  items,
});

/**
 * @param {string} id
 * @param {string} label
 */
const doc = (id, label) => ({type: /** @type {const} */ ('doc'), id, label});

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    doc('index', 'Overview'),
    category('Get started', [
      doc('getting-started', 'Run hosting-service'),
      doc('configuration', 'Configuration'),
    ]),
    category('Core concepts', [
      doc('apps-and-deployments', 'Apps and deployments'),
      doc('preview-and-serving', 'Preview sites and public URLs'),
      doc('company-access', 'Company access'),
    ]),
    category('Authentication', [
      doc('claim-trust', 'JWT and claim trust'),
    ]),
    category('Webhooks', [
      doc('actions', 'Webhooks'),
      doc('n8n', 'n8n'),
      doc('event-log', 'Event log'),
    ]),
    category('Email', [
      doc('email', 'Email notifications'),
    ]),
    category('Operations', [
      doc('security-hardening', 'Security hardening'),
      doc('maintenance-jobs', 'Scheduled jobs'),
    ]),
    category('API', [
      doc('api', 'API reference'),
    ]),
  ],
};

module.exports = sidebars;
