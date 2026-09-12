import {
  DEFAULT_SHELLUI_BACKEND_URL,
  DEFAULT_SHELLUI_LOGIN_METHODS,
  FRAMEWORK_COMPANIONS,
  getBackend,
  getFramework,
  getPositionalFrameworkIds,
} from './registry.js';
import { formatDevRun } from './package-manager.js';
import { CONFIG_SCHEMA_REF } from '../utils/config-paths.js';

/**
 * @typedef {{
 *   framework?: string | null,
 *   backend?: string | null,
 *   companyId?: string | number | null,
 *   supabaseUrl?: string | null,
 *   force?: boolean,
 *   noInstall?: boolean,
 * }} InitOptions
 */

/**
 * Parse the optional positional `[framework]` / `[root]` argument.
 * @param {string | undefined} frameworkOrRoot
 * @returns {{ root: string, frameworkShortcut: string | null }}
 */
export function parseInitArgs(frameworkOrRoot) {
  const positional = getPositionalFrameworkIds();
  if (frameworkOrRoot && positional.includes(frameworkOrRoot)) {
    return { root: '.', frameworkShortcut: frameworkOrRoot };
  }
  if (frameworkOrRoot) {
    return { root: frameworkOrRoot, frameworkShortcut: null };
  }
  return { root: '.', frameworkShortcut: null };
}

/**
 * Normalize companyId for BackendConfig (numeric strings → number).
 * @param {string | number} companyId
 * @returns {string | number}
 */
export function normalizeCompanyId(companyId) {
  if (typeof companyId === 'number') return companyId;
  const trimmed = String(companyId).trim();
  if (trimmed !== '' && !Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed.includes('.') ? trimmed : parseInt(trimmed, 10));
  }
  return trimmed;
}

/**
 * Resolve framework + backend when flags are partial (non-interactive defaults).
 * @param {{ framework: string | null, backend: string | null }} input
 * @returns {{ framework: string, backend: string }}
 */
export function applyInitDefaults({ framework, backend }) {
  return {
    framework: framework || 'empty',
    backend: backend || 'none',
  };
}

/**
 * Validate non-interactive init options. Throws with a clear message on failure.
 * @param {{
 *   framework: string,
 *   backend: string,
 *   companyId?: string | number | null,
 *   supabaseUrl?: string | null,
 * }} input
 */
export function validateInitOptions({ framework, backend, companyId, supabaseUrl }) {
  if (!getFramework(framework)) {
    throw new Error(`Unknown framework "${framework}". Use empty, react, vue, angular, or other.`);
  }
  if (!getBackend(backend)) {
    throw new Error(`Unknown backend "${backend}". Use none, shellui, or supabase.`);
  }

  const backendDef = getBackend(backend);
  if (
    backendDef?.requires === 'companyId' &&
    (companyId === null || companyId === undefined || companyId === '')
  ) {
    throw new Error('--company-id is required when using --backend shellui');
  }
  if (
    backendDef?.requires === 'supabaseUrl' &&
    (supabaseUrl === null || supabaseUrl === undefined || supabaseUrl === '')
  ) {
    throw new Error('--supabase-url is required when using --backend supabase');
  }
}

/**
 * Build the base shellui.config.json object (no backend).
 * @returns {Record<string, unknown>}
 */
export function buildBaseConfig() {
  return {
    $schema: CONFIG_SCHEMA_REF,
    port: 4000,
    title: 'My App',
    favicon: '/favicon.svg',
    logo: '/logo.svg',
    layout: 'sidebar',
    language: 'en',
    theme: 'shellui',
    navigation: [
      {
        // Empty path = shell root (`/`). Core treats '' and '/' as the root nav item
        // (see useNavigationItems); '' avoids a /home route that hides the companion.
        label: 'Home',
        path: '',
        url: '/',
      },
      {
        label: 'Settings',
        path: 'settings',
        url: '/__settings',
        openIn: 'modal',
        position: 'end',
      },
    ],
  };
}

/**
 * Attach backend section matching BackendConfig, or omit when backend is none.
 * @param {Record<string, unknown>} config
 * @param {{
 *   backend: string,
 *   companyId?: string | number | null,
 *   supabaseUrl?: string | null,
 * }} opts
 * @returns {Record<string, unknown>}
 */
export function applyBackendConfig(config, { backend, companyId, supabaseUrl }) {
  const next = { ...config };
  if (backend === 'shellui') {
    next.backend = {
      type: 'shellui',
      url: DEFAULT_SHELLUI_BACKEND_URL,
      companyId: normalizeCompanyId(/** @type {string | number} */ (companyId)),
      login: {
        methods: [...DEFAULT_SHELLUI_LOGIN_METHODS],
      },
    };
  } else if (backend === 'supabase') {
    next.backend = {
      type: 'supabase',
      url: supabaseUrl,
    };
  }
  // backend === 'none' → omit backend key
  return next;
}

/**
 * Whether a nav item is the shell Home / root entry.
 * @param {unknown} item
 * @returns {boolean}
 */
function isHomeNavItem(item) {
  return (
    !!item &&
    typeof item === 'object' &&
    /** @type {{ path?: unknown }} */ ((item).path === '' ||
      /** @type {{ path?: unknown }} */ (item).path === '/')
  );
}

/**
 * Wire `dev.run` / `dev.url` and Home nav so `shellui start` launches the
 * framework companion and embeds it in the shell iframe at shell `/`.
 * Empty / other frameworks leave Home at `/` and omit `dev`.
 * @param {Record<string, unknown>} config
 * @param {string} framework
 * @param {{ packageManager?: string | null }} [opts]
 * @returns {Record<string, unknown>}
 */
export function applyCompanionConfig(config, framework, opts = {}) {
  const companion = FRAMEWORK_COMPANIONS[framework];
  if (!companion) {
    return config;
  }

  const packageManager = opts.packageManager || 'npm';
  const next = {
    ...config,
    dev: {
      run: formatDevRun(packageManager),
      url: companion.url,
      name: companion.name,
    },
  };

  const navigation = Array.isArray(config.navigation) ? [...config.navigation] : [];
  next.navigation = navigation.map((item) => {
    if (isHomeNavItem(item)) {
      return { ...item, url: `${companion.url}/` };
    }
    return item;
  });

  return next;
}

/**
 * Full config object for the resolved wizard / flag answers.
 * @param {{
 *   framework?: string,
 *   backend: string,
 *   companyId?: string | number | null,
 *   supabaseUrl?: string | null,
 *   packageManager?: string | null,
 * }} opts
 */
export function buildInitConfig(opts) {
  const { framework = 'empty', packageManager, ...backendOpts } = opts;
  return applyCompanionConfig(applyBackendConfig(buildBaseConfig(), backendOpts), framework, {
    packageManager,
  });
}
