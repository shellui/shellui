/**
 * Single source of truth for `shellui init` framework and backend choices.
 * Add new starters / backends here — the wizard, flags, and tests all read this registry.
 */

/** @typedef {'empty' | 'react' | 'vue' | 'angular' | 'other'} FrameworkId */
/** @typedef {'none' | 'shellui' | 'supabase'} BackendId */

/**
 * @typedef {{
 *   id: FrameworkId,
 *   label: string,
 *   hint: string,
 *   scaffold: 'empty' | 'fetch' | 'skip',
 *   positional?: boolean,
 * }} FrameworkDefinition
 */

/**
 * @typedef {{
 *   id: BackendId,
 *   label: string,
 *   hint: string,
 *   requires?: 'companyId' | 'supabaseUrl',
 * }} BackendDefinition
 */

/** @type {FrameworkDefinition[]} */
export const FRAMEWORKS = [
  {
    id: 'empty',
    label: 'Empty shell (no framework)',
    hint: 'Minimal config + static stubs',
    scaffold: 'empty',
    positional: true,
  },
  {
    id: 'react',
    label: 'React (Vite + React)',
    hint: 'Full React starter with SDK',
    scaffold: 'fetch',
    positional: true,
  },
  {
    id: 'vue',
    label: 'Vue (Vite + Vue)',
    hint: 'Full Vue starter with SDK',
    scaffold: 'fetch',
    positional: true,
  },
  {
    id: 'angular',
    label: 'Angular',
    hint: 'Full Angular starter with SDK',
    scaffold: 'fetch',
    positional: true,
  },
  {
    id: 'other',
    label: 'Other (coming soon)',
    hint: 'Skip scaffold',
    scaffold: 'skip',
    positional: false,
  },
];

/** @type {BackendDefinition[]} */
export const BACKENDS = [
  {
    id: 'none',
    label: 'No backend (frontend only)',
    hint: 'No auth/API integration',
  },
  {
    id: 'shellui',
    label: 'Shellui',
    hint: 'Official Shellui backend',
    requires: 'companyId',
  },
  {
    id: 'supabase',
    label: 'Supabase',
    hint: 'Open source Firebase alternative',
    requires: 'supabaseUrl',
  },
];

/** Default Shellui backend API URL written by init. */
export const DEFAULT_SHELLUI_BACKEND_URL = 'https://id.shellui.com';

/** Default login methods when backend is shellui. */
export const DEFAULT_SHELLUI_LOGIN_METHODS = /** @type {const} */ (['password', 'oauth']);

/**
 * Framework IDs accepted as a positional `shellui init <framework>` shortcut.
 * @returns {FrameworkId[]}
 */
export function getPositionalFrameworkIds() {
  return FRAMEWORKS.filter((f) => f.positional).map((f) => f.id);
}

/**
 * @param {string} id
 * @returns {FrameworkDefinition | undefined}
 */
export function getFramework(id) {
  return FRAMEWORKS.find((f) => f.id === id);
}

/**
 * @param {string} id
 * @returns {BackendDefinition | undefined}
 */
export function getBackend(id) {
  return BACKENDS.find((b) => b.id === id);
}

/**
 * Options for @clack/prompts select().
 * @returns {{ value: string, label: string, hint: string }[]}
 */
export function getFrameworkPromptOptions() {
  return FRAMEWORKS.map((f) => ({ value: f.id, label: f.label, hint: f.hint }));
}

/**
 * Options for @clack/prompts select().
 * @returns {{ value: string, label: string, hint: string }[]}
 */
export function getBackendPromptOptions() {
  return BACKENDS.map((b) => ({ value: b.id, label: b.label, hint: b.hint }));
}

/**
 * Relative paths fetched for each on-demand framework template.
 * Kept here so registry + fetch layer stay aligned.
 * Sources: official `create-vite` react/vue templates and `ng new` Angular defaults.
 * @type {Record<'react' | 'vue' | 'angular', string[]>}
 */
export const TEMPLATE_FILES = {
  react: [
    'package.json',
    'index.html',
    'vite.config.js',
    'README.md',
    '.gitignore',
    'public/favicon.svg',
    'public/icons.svg',
    'src/main.jsx',
    'src/App.jsx',
    'src/App.css',
    'src/index.css',
    'src/assets/hero.png',
    'src/assets/react.svg',
    'src/assets/vite.svg',
    'static/favicon.svg',
    'static/logo.svg',
  ],
  vue: [
    'package.json',
    'index.html',
    'vite.config.js',
    'README.md',
    '.gitignore',
    'public/favicon.svg',
    'public/icons.svg',
    'src/main.js',
    'src/App.vue',
    'src/style.css',
    'src/components/HelloWorld.vue',
    'src/assets/hero.png',
    'src/assets/vite.svg',
    'src/assets/vue.svg',
    'static/favicon.svg',
    'static/logo.svg',
  ],
  angular: [
    'package.json',
    'angular.json',
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.spec.json',
    'README.md',
    '.gitignore',
    '.editorconfig',
    'public/favicon.ico',
    'src/main.ts',
    'src/index.html',
    'src/styles.css',
    'src/app/app.config.ts',
    'src/app/app.component.ts',
    'src/app/app.component.html',
    'src/app/app.component.css',
    'src/app/app.component.spec.ts',
    'static/favicon.ico',
    'static/favicon.svg',
    'static/logo.svg',
  ],
};
