import { describe, test, expect } from 'vitest';
import {
  FRAMEWORKS,
  BACKENDS,
  TEMPLATE_FILES,
  FRAMEWORK_COMPANIONS,
  getFramework,
  getBackend,
  getPositionalFrameworkIds,
  getFrameworkPromptOptions,
  getBackendPromptOptions,
  getFrameworkIdsList,
  DEFAULT_SHELLUI_BACKEND_URL,
  DEFAULT_SHELLUI_LOGIN_METHODS,
} from '../registry.js';

const FETCH_FRAMEWORKS = ['react', 'vue', 'angular', 'next', 'nuxt', 'svelte', 'flutter'];

describe('init registry', () => {
  test('registers empty, react, vue, angular, next, nuxt, svelte, and flutter frameworks', () => {
    const ids = FRAMEWORKS.map((f) => f.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'empty',
        'react',
        'vue',
        'angular',
        'next',
        'nuxt',
        'svelte',
        'flutter',
      ]),
    );
  });

  test('positional shortcuts cover empty and all fetch frameworks', () => {
    expect(getPositionalFrameworkIds()).toEqual([
      'empty',
      'react',
      'vue',
      'angular',
      'next',
      'nuxt',
      'svelte',
      'flutter',
    ]);
  });

  test('fetch frameworks have template file lists and companions', () => {
    for (const id of FETCH_FRAMEWORKS) {
      expect(getFramework(id)?.scaffold).toBe('fetch');
      expect(TEMPLATE_FILES[id]?.length).toBeGreaterThan(0);
      expect(FRAMEWORK_COMPANIONS[id]?.url).toMatch(/^http:\/\/localhost:\d+$/);
      expect(FRAMEWORK_COMPANIONS[id]?.run).toBeTruthy();
    }
  });

  test('flutter companion is fixed-run Flutter Web server on 8080', () => {
    expect(FRAMEWORK_COMPANIONS.flutter).toMatchObject({
      fixedRun: true,
      install: 'flutter',
      manifest: 'pubspec.yaml',
      url: 'http://localhost:8080',
      run: 'flutter run -d web-server --web-hostname=localhost --web-port=8080',
    });
  });

  test('next/nuxt use port 3000; svelte uses 5173', () => {
    expect(FRAMEWORK_COMPANIONS.next.url).toBe('http://localhost:3000');
    expect(FRAMEWORK_COMPANIONS.nuxt.url).toBe('http://localhost:3000');
    expect(FRAMEWORK_COMPANIONS.svelte.url).toBe('http://localhost:5173');
  });

  test('empty is local scaffold; other skips scaffold', () => {
    expect(getFramework('empty')?.scaffold).toBe('empty');
    expect(getFramework('other')?.scaffold).toBe('skip');
  });

  test('backends cover none, shellui, supabase with required fields', () => {
    expect(BACKENDS.map((b) => b.id)).toEqual(['none', 'shellui', 'supabase']);
    expect(getBackend('shellui')?.requires).toBe('companyId');
    expect(getBackend('supabase')?.requires).toBe('supabaseUrl');
    expect(getBackend('none')?.requires).toBeUndefined();
  });

  test('prompt options are derived from the same registry', () => {
    expect(getFrameworkPromptOptions().map((o) => o.value)).toEqual(FRAMEWORKS.map((f) => f.id));
    expect(getBackendPromptOptions().map((o) => o.value)).toEqual(BACKENDS.map((b) => b.id));
  });

  test('getFrameworkIdsList includes all registered ids', () => {
    expect(getFrameworkIdsList()).toContain('next');
    expect(getFrameworkIdsList()).toContain('flutter');
  });

  test('shellui defaults match BackendConfig shape expectations', () => {
    expect(DEFAULT_SHELLUI_BACKEND_URL).toMatch(/^https:\/\//);
    expect([...DEFAULT_SHELLUI_LOGIN_METHODS]).toEqual(['password', 'oauth']);
  });

  test('flutter hint documents Web-only', () => {
    expect(getFramework('flutter')?.hint).toMatch(/Web only/i);
  });

  test('svelte TEMPLATE_FILES includes svelte.config.js and vscode extensions', () => {
    expect(TEMPLATE_FILES.svelte).toEqual(
      expect.arrayContaining(['svelte.config.js', '.vscode/extensions.json', 'vite.config.js']),
    );
  });

  test('next TEMPLATE_FILES includes ensure-port script', () => {
    expect(TEMPLATE_FILES.next).toContain('scripts/ensure-port.mjs');
  });

  test('JS templates list theme/i18n wiring files', () => {
    expect(TEMPLATE_FILES.react).toEqual(
      expect.arrayContaining(['src/i18n.js', 'src/useShellui.js']),
    );
    expect(TEMPLATE_FILES.vue).toEqual(
      expect.arrayContaining(['src/i18n.js', 'src/composables/useShellui.js']),
    );
    expect(TEMPLATE_FILES.angular).toEqual(
      expect.arrayContaining(['src/app/i18n.ts', 'src/app/shellui.service.ts']),
    );
    expect(TEMPLATE_FILES.next).toEqual(expect.arrayContaining(['app/home.js', 'app/i18n.js']));
    expect(TEMPLATE_FILES.next).not.toContain('app/shellui-client.js');
    expect(TEMPLATE_FILES.nuxt).toEqual(
      expect.arrayContaining([
        'app/i18n.ts',
        'app/composables/useShellui.ts',
        'app/plugins/shellui.client.ts',
      ]),
    );
    expect(TEMPLATE_FILES.svelte).toEqual(
      expect.arrayContaining(['src/lib/i18n.js', 'src/lib/shellui.js', 'src/app.css']),
    );
  });
});
