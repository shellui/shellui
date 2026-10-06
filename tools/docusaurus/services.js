// @ts-check
/**
 * Service documentation that the main Shellui docs site pulls in at build time.
 *
 * Each entry becomes one `@docusaurus/plugin-content-docs` instance, one navbar
 * entry and one folder under `.services/`. The fetch script
 * (`scripts/fetch-service-docs.js`) resolves where each service's docs come from
 * and writes `.services/manifest.json`, which `docusaurus.config.js` reads.
 *
 * Environment variables (all optional):
 *
 * - `DOCS_SOURCE`: `auto` (default), `local` or `remote`.
 *   `auto` uses a sibling checkout when it exists and falls back to GitHub.
 * - `DOCS_SERVICES_DIR`: folder that holds sibling checkouts.
 *   Defaults to the parent folder of this repository.
 * - `DOCS_SERVICES`: comma separated list of service ids to include.
 *   Defaults to every service below.
 * - `DOCS_ALLOW_MISSING=1`: skip a service that cannot be fetched instead of failing.
 * - `DOCS_GITHUB_TOKEN`: token used for remote clones, only needed for private repos.
 * - `<ID>_DOCS_REF`: branch, tag or commit to fetch, for example `IDENTITY_DOCS_REF`.
 *   Defaults to `main`.
 * - `<ID>_DOCS_REPO`: `owner/name` on GitHub, for example to build from a fork.
 * - `<ID>_DOCS_PATH`: path to a local `docs/` folder. Forces local mode for that service.
 * - `<ID>_DOCS_SOURCE`: `auto`, `local` or `remote` for one service only.
 */

const path = require('path');

const SITE_DIR = __dirname;
const REPO_ROOT = path.resolve(SITE_DIR, '..', '..');
const SERVICES_DIR = path.join(SITE_DIR, '.services');
const MANIFEST_PATH = path.join(SERVICES_DIR, 'manifest.json');
const DEFAULT_SIDEBAR_PATH = path.join(SITE_DIR, 'sidebars.service-default.js');

// A service's own sidebar is reused when one of these files exists. `docs/sidebars.js`
// lets a service drop its `tools/docusaurus/` site and keep its sidebar.
const SIDEBAR_FILES = ['docs/sidebars.js', 'tools/docusaurus/sidebars.js'];

/**
 * @typedef {object} ServiceDefinition
 * @property {string} id Plugin id, folder name and environment variable prefix.
 * @property {string} label Navbar label.
 * @property {string} repo GitHub `owner/name`.
 * @property {string} routeBasePath URL prefix on docs.shellui.com.
 * @property {string} legacyHost Host the service docs used to publish to.
 * @property {string} docsDir Docs folder inside the service repo.
 * @property {string[]} sidebarFiles Sidebar files inside the service repo, first match wins.
 */

/** @type {ServiceDefinition[]} */
const SERVICES = [
  {
    id: 'identity',
    label: 'Identity',
    repo: 'shellui/identity-service',
    routeBasePath: 'identity',
    legacyHost: 'identity.docs.shellui.com',
    docsDir: 'docs',
    sidebarFiles: SIDEBAR_FILES,
  },
  {
    id: 'storage',
    label: 'Storage',
    repo: 'shellui/storage-service',
    routeBasePath: 'storage',
    legacyHost: 'storage.docs.shellui.com',
    docsDir: 'docs',
    sidebarFiles: SIDEBAR_FILES,
  },
  {
    id: 'hosting',
    label: 'Hosting',
    repo: 'shellui/hosting-service',
    routeBasePath: 'hosting',
    legacyHost: 'hosting.docs.shellui.com',
    docsDir: 'docs',
    sidebarFiles: SIDEBAR_FILES,
  },
  {
    id: 'email',
    label: 'Email',
    repo: 'shellui/email-service',
    routeBasePath: 'email',
    legacyHost: 'email.docs.shellui.com',
    docsDir: 'docs',
    sidebarFiles: SIDEBAR_FILES,
  },
];

/**
 * @param {ServiceDefinition} service
 * @param {string} name
 * @returns {string | undefined}
 */
function serviceEnv(service, name) {
  const value = process.env[`${service.id.toUpperCase()}_DOCS_${name}`];
  return value && value.trim() ? value.trim() : undefined;
}

/** @returns {ServiceDefinition[]} */
function selectedServices() {
  const raw = process.env.DOCS_SERVICES;
  if (!raw || !raw.trim()) {
    return SERVICES;
  }
  const wanted = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const unknown = wanted.filter((id) => !SERVICES.some((service) => service.id === id));
  if (unknown.length > 0) {
    throw new Error(
      `DOCS_SERVICES lists unknown services: ${unknown.join(', ')}. Known: ${SERVICES.map((s) => s.id).join(', ')}`,
    );
  }
  return SERVICES.filter((service) => wanted.includes(service.id));
}

module.exports = {
  SERVICES,
  SITE_DIR,
  REPO_ROOT,
  SERVICES_DIR,
  MANIFEST_PATH,
  DEFAULT_SIDEBAR_PATH,
  serviceEnv,
  selectedServices,
};
