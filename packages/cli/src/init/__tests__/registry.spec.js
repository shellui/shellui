import { describe, test, expect } from 'vitest';
import {
  FRAMEWORKS,
  BACKENDS,
  TEMPLATE_FILES,
  getFramework,
  getBackend,
  getPositionalFrameworkIds,
  getFrameworkPromptOptions,
  getBackendPromptOptions,
  DEFAULT_SHELLUI_BACKEND_URL,
  DEFAULT_SHELLUI_LOGIN_METHODS,
} from '../registry.js';

describe('init registry', () => {
  test('registers empty, react, vue, and angular frameworks', () => {
    const ids = FRAMEWORKS.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['empty', 'react', 'vue', 'angular']));
  });

  test('positional shortcuts cover empty/react/vue/angular only', () => {
    expect(getPositionalFrameworkIds()).toEqual(['empty', 'react', 'vue', 'angular']);
  });

  test('react/vue/angular are fetch scaffolds with template file lists', () => {
    for (const id of ['react', 'vue', 'angular']) {
      expect(getFramework(id)?.scaffold).toBe('fetch');
      expect(TEMPLATE_FILES[id]?.length).toBeGreaterThan(0);
    }
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

  test('shellui defaults match BackendConfig shape expectations', () => {
    expect(DEFAULT_SHELLUI_BACKEND_URL).toMatch(/^https:\/\//);
    expect([...DEFAULT_SHELLUI_LOGIN_METHODS]).toEqual(['password', 'oauth']);
  });
});
