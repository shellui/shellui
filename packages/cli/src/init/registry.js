/**
 * Single source of truth for `shellui init` framework and backend choices.
 * Add new starters / backends here — the wizard, flags, and tests all read this registry.
 */

/** @typedef {'empty' | 'react' | 'vue' | 'angular' | 'next' | 'nuxt' | 'svelte' | 'alpine' | 'flutter' | 'other'} FrameworkId */
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

/**
 * @typedef {{
 *   run: string,
 *   url: string,
 *   name: string,
 *   fixedRun?: boolean,
 *   install?: 'npm' | 'flutter',
 *   manifest?: string,
 * }} FrameworkCompanion
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
    id: 'next',
    label: 'Next.js (App Router)',
    hint: 'Official create-next-app starter with SDK',
    scaffold: 'fetch',
    positional: true,
  },
  {
    id: 'nuxt',
    label: 'Nuxt',
    hint: 'Official Nuxt minimal starter with SDK',
    scaffold: 'fetch',
    positional: true,
  },
  {
    id: 'svelte',
    label: 'SvelteKit',
    hint: 'Official sv create minimal starter with SDK',
    scaffold: 'fetch',
    positional: true,
  },
  {
    id: 'alpine',
    label: 'Alpine.js (Vite)',
    hint: 'Official Alpine npm + Vite starter with SDK',
    scaffold: 'fetch',
    positional: true,
  },
  {
    id: 'flutter',
    label: 'Flutter Web',
    hint: 'Web only (not iOS/Android) — requires Flutter SDK',
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
 * Companion `dev` + Home iframe URL for framework starters.
 * Shell stays on port 4000; Vite apps use 5173, Angular 4200, Next/Nuxt 3000, Flutter Web 8080.
 * For npm-based frameworks, `run` is rewritten to `{detectedPm} run dev` unless `fixedRun`.
 * @type {Record<'react' | 'vue' | 'angular' | 'next' | 'nuxt' | 'svelte' | 'alpine' | 'flutter', FrameworkCompanion>}
 */
export const FRAMEWORK_COMPANIONS = {
  react: {
    run: 'npm run dev',
    url: 'http://localhost:5173',
    name: 'react',
    install: 'npm',
    manifest: 'package.json',
  },
  vue: {
    run: 'npm run dev',
    url: 'http://localhost:5173',
    name: 'vue',
    install: 'npm',
    manifest: 'package.json',
  },
  angular: {
    run: 'npm run dev',
    url: 'http://localhost:4200',
    name: 'angular',
    install: 'npm',
    manifest: 'package.json',
  },
  next: {
    run: 'npm run dev',
    url: 'http://localhost:3000',
    name: 'next',
    install: 'npm',
    manifest: 'package.json',
  },
  nuxt: {
    run: 'npm run dev',
    url: 'http://localhost:3000',
    name: 'nuxt',
    install: 'npm',
    manifest: 'package.json',
  },
  svelte: {
    run: 'npm run dev',
    url: 'http://localhost:5173',
    name: 'svelte',
    install: 'npm',
    manifest: 'package.json',
  },
  alpine: {
    run: 'npm run dev',
    url: 'http://localhost:5173',
    name: 'alpine',
    install: 'npm',
    manifest: 'package.json',
  },
  flutter: {
    run: 'flutter run -d web-server --web-hostname=localhost --web-port=8080',
    url: 'http://localhost:8080',
    name: 'flutter',
    fixedRun: true,
    install: 'flutter',
    manifest: 'pubspec.yaml',
  },
};

/**
 * Framework IDs accepted as a positional `shellui init <framework>` shortcut.
 * @returns {FrameworkId[]}
 */
export function getPositionalFrameworkIds() {
  return FRAMEWORKS.filter((f) => f.positional).map((f) => f.id);
}

/**
 * Human-readable list of known framework ids for error messages.
 * @returns {string}
 */
export function getFrameworkIdsList() {
  return FRAMEWORKS.map((f) => f.id).join(', ');
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
 * Sources: official create-vite / ng new / create-next-app / nuxi / sv create / Alpine npm+Vite / flutter create.
 * @type {Record<'react' | 'vue' | 'angular' | 'next' | 'nuxt' | 'svelte' | 'alpine' | 'flutter', string[]>}
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
    'src/i18n.js',
    'src/useShellui.js',
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
    'src/i18n.js',
    'src/composables/useShellui.js',
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
    'src/app/i18n.ts',
    'src/app/shellui.service.ts',
    'static/favicon.ico',
    'static/favicon.svg',
    'static/logo.svg',
  ],
  next: [
    'package.json',
    'next.config.mjs',
    'jsconfig.json',
    'eslint.config.mjs',
    'README.md',
    '.gitignore',
    'scripts/ensure-port.mjs',
    'app/layout.js',
    'app/page.js',
    'app/page.module.css',
    'app/globals.css',
    'app/favicon.ico',
    'app/home.js',
    'app/i18n.js',
    'public/next.svg',
    'public/vercel.svg',
    'public/file.svg',
    'public/globe.svg',
    'public/window.svg',
    'static/favicon.svg',
    'static/logo.svg',
  ],
  nuxt: [
    'package.json',
    'nuxt.config.ts',
    'tsconfig.json',
    'README.md',
    '.gitignore',
    'app/app.vue',
    'app/i18n.ts',
    'app/composables/useShellui.ts',
    'app/plugins/shellui.client.ts',
    'public/favicon.ico',
    'public/robots.txt',
    'static/favicon.svg',
    'static/logo.svg',
  ],
  svelte: [
    'package.json',
    'svelte.config.js',
    'vite.config.js',
    'jsconfig.json',
    '.npmrc',
    'README.md',
    '.gitignore',
    '.vscode/extensions.json',
    'src/app.html',
    'src/app.css',
    'src/app.d.ts',
    'src/lib/index.js',
    'src/lib/i18n.js',
    'src/lib/shellui.js',
    'src/lib/assets/favicon.svg',
    'src/routes/+layout.svelte',
    'src/routes/+page.svelte',
    'static/robots.txt',
    'static/favicon.svg',
    'static/logo.svg',
  ],
  alpine: [
    'package.json',
    'index.html',
    'vite.config.js',
    'README.md',
    '.gitignore',
    'public/favicon.svg',
    'src/main.js',
    'src/i18n.js',
    'src/style.css',
    'static/favicon.svg',
    'static/logo.svg',
  ],
  flutter: [
    'pubspec.yaml',
    'analysis_options.yaml',
    'README.md',
    '.gitignore',
    'lib/main.dart',
    'web/index.html',
    'web/favicon.png',
    'web/manifest.json',
    'web/icons/Icon-192.png',
    'web/icons/Icon-512.png',
    'web/icons/Icon-maskable-192.png',
    'web/icons/Icon-maskable-512.png',
    'static/favicon.svg',
    'static/logo.svg',
  ],
};
