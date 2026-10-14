// @ts-check
// Sidebar for docs.shellui.com/identity. The central site in shellui/shellui
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
      doc('getting-started', 'Run identity-service'),
      doc('configuration', 'Configuration'),
    ]),
    category('Sign-in', [
      doc('oauth-login', 'OAuth login'),
      doc('desktop-apps', 'Desktop apps'),
      doc('oauth-providers', 'OAuth providers'),
      doc('magic-link', 'Magic link'),
      doc('saml', 'SAML single sign-on'),
    ]),
    category('Companies and users', [
      doc('company-access', 'Company access'),
      doc('scim', 'SCIM provisioning'),
      doc('account-deletion', 'Account deletion'),
    ]),
    category('Tokens', [
      doc('jwks', 'JWT and JWKS'),
      doc('metrics', 'Metrics and access tokens'),
    ]),
    category('Events and email', [
      doc('actions', 'Webhooks'),
      doc('n8n', 'n8n'),
      doc('event-log', 'Event log'),
      doc('email-service', 'Email delivery'),
    ]),
    category('Operations', [
      doc('scheduled-jobs', 'Scheduled jobs'),
      doc('security-hardening', 'Security hardening'),
      doc('upgrading', 'Upgrade notes'),
      doc('RELEASES', 'Releases'),
    ]),
  ],
};

module.exports = sidebars;
