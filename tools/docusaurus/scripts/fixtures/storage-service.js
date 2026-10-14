// @ts-check
// Sidebar for docs.shellui.com/storage. The central site in shellui/shellui
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
      doc('getting-started', 'Run storage-service'),
      doc('configuration', 'Configuration'),
    ]),
    category('Core concepts', [
      doc('buckets-and-objects', 'Buckets, folders, and files'),
      doc('access', 'Access grants'),
      doc('sharing', 'Share links'),
      doc('quotas', 'Quotas'),
      doc('downloads', 'Downloads and signed URLs'),
      doc('clients', 'WebDAV'),
    ]),
    category('Authentication', [
      doc('authentication', 'JWT and claim trust'),
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
      doc('security', 'Security hardening'),
      doc('maintenance-jobs', 'Scheduled jobs'),
    ]),
    category('API', [
      doc('api', 'API reference'),
    ]),
  ],
};

module.exports = sidebars;
