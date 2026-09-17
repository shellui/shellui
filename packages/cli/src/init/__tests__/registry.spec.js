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

const FETCH_FRAMEWORKS = ['react', 'vue', 'angular', 'next', 'nuxt', 'svelte', 'alpine'];

describe('init registry', () => {
  test('registers empty, react, vue, angular, next, nuxt, svelte, and alpine frameworks', () => {
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
        'alpine',
      ]),
    );
    expect(ids).not.toContain('flutter');
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
      'alpine',
    ]);
    expect(getPositionalFrameworkIds()).not.toContain('flutter');
  });

  test('fetch frameworks have template file lists and companions', () => {
    for (const id of FETCH_FRAMEWORKS) {
      expect(getFramework(id)?.scaffold).toBe('fetch');
      expect(TEMPLATE_FILES[id]?.length).toBeGreaterThan(0);
      expect(FRAMEWORK_COMPANIONS[id]?.url).toMatch(/^http:\/\/localhost:\d+$/);
      expect(FRAMEWORK_COMPANIONS[id]?.run).toBeTruthy();
    }
  });

  test('flutter is not a registered framework or companion', () => {
    expect(getFramework('flutter')).toBeUndefined();
    expect(FRAMEWORK_COMPANIONS.flutter).toBeUndefined();
    expect(TEMPLATE_FILES.flutter).toBeUndefined();
  });

  test('next/nuxt use port 3000; svelte and alpine use 5173', () => {
    expect(FRAMEWORK_COMPANIONS.next.url).toBe('http://localhost:3000');
    expect(FRAMEWORK_COMPANIONS.nuxt.url).toBe('http://localhost:3000');
    expect(FRAMEWORK_COMPANIONS.svelte.url).toBe('http://localhost:5173');
    expect(FRAMEWORK_COMPANIONS.alpine.url).toBe('http://localhost:5173');
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
    expect(getFrameworkPromptOptions().map((o) => o.value)).not.toContain('flutter');
  });

  test('getFrameworkIdsList includes all registered ids and excludes flutter', () => {
    expect(getFrameworkIdsList()).toContain('next');
    expect(getFrameworkIdsList()).toContain('alpine');
    expect(getFrameworkIdsList()).not.toContain('flutter');
  });

  test('shellui defaults match BackendConfig shape expectations', () => {
    expect(DEFAULT_SHELLUI_BACKEND_URL).toMatch(/^https:\/\//);
    expect([...DEFAULT_SHELLUI_LOGIN_METHODS]).toEqual(['password', 'oauth']);
  });

  test('svelte TEMPLATE_FILES includes svelte.config.js and vscode extensions', () => {
    expect(TEMPLATE_FILES.svelte).toEqual(
      expect.arrayContaining(['svelte.config.js', '.vscode/extensions.json', 'vite.config.js']),
    );
  });

  test('next TEMPLATE_FILES includes ensure-port script', () => {
    expect(TEMPLATE_FILES.next).toContain('scripts/ensure-port.mjs');
  });

  test('alpine TEMPLATE_FILES includes SDK entry and deploy env example', () => {
    expect(TEMPLATE_FILES.alpine).toEqual(
      expect.arrayContaining(['.env.example', 'src/main.js', 'vite.config.js', 'static/logo.svg']),
    );
  });

  test('JS templates list boilerplate, CLI, and SDK handshake files', () => {
    expect(TEMPLATE_FILES.react).toEqual(
      expect.arrayContaining(['.env.example', 'src/assets/hero.png', 'src/main.jsx']),
    );
    expect(TEMPLATE_FILES.vue).toEqual(
      expect.arrayContaining(['src/components/HelloWorld.vue', 'src/assets/hero.png']),
    );
    expect(TEMPLATE_FILES.angular).toEqual(
      expect.arrayContaining(['scripts/copy-browser.mjs', 'src/app/app.component.html']),
    );
    expect(TEMPLATE_FILES.next).toEqual(
      expect.arrayContaining(['app/shellui-client.js', 'scripts/copy-export.mjs']),
    );
    expect(TEMPLATE_FILES.next).not.toContain('app/home.js');
    expect(TEMPLATE_FILES.nuxt).toEqual(
      expect.arrayContaining(['app/plugins/shellui.client.ts']),
    );
    expect(TEMPLATE_FILES.svelte).toEqual(
      expect.arrayContaining(['svelte.config.js', 'src/routes/+layout.svelte']),
    );
  });
});
