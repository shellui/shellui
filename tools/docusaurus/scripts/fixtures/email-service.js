// @ts-check
// Sidebar for docs.shellui.com/email. The central site in shellui/shellui
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
      doc('getting-started', 'Run email-service'),
      doc('configuration', 'Configuration'),
    ]),
    category('Integrating a service', [
      doc('authentication', 'Service keys'),
      doc('events', 'Events catalog'),
      doc('integration', 'Integration contract'),
    ]),
    category('Company email', [
      doc('providers', 'Providers'),
      doc('rules', 'Email rules'),
      doc('templates', 'Templates and translations'),
      doc('library', 'Design library'),
    ]),
    category('Newsletters and broadcasts', [
      doc('newsletters', 'Newsletters'),
      doc('broadcasts', 'Broadcasts'),
    ]),
    category('Delivery', [
      doc('lanes', 'Lanes'),
      doc('scheduled-jobs', 'Scheduled jobs'),
    ]),
    category('Webhooks', [
      doc('actions', 'Webhooks'),
      doc('n8n', 'n8n'),
      doc('event-log', 'Event log'),
    ]),
    category('Operations', [
      doc('security', 'Security'),
      doc('metrics', 'Metrics'),
      doc('troubleshooting', 'Troubleshooting'),
    ]),
  ],
};

module.exports = sidebars;
