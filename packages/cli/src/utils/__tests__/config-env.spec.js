import { test, describe, expect } from 'vitest';
import { substituteEnvInString, substituteEnvInConfig } from '../config-env.js';

describe('substituteEnvInString', () => {
  test('replaces ${VAR}', () => {
    expect(substituteEnvInString('hello ${NAME}', { NAME: 'world' })).toBe('hello world');
  });

  test('uses default when unset: ${VAR:-default}', () => {
    expect(substituteEnvInString('${URL:-https://example.com}', {})).toBe('https://example.com');
  });

  test('uses default when empty string', () => {
    expect(substituteEnvInString('${URL:-fallback}', { URL: '' })).toBe('fallback');
  });

  test('prefers env over default', () => {
    expect(substituteEnvInString('${URL:-fallback}', { URL: 'http://localhost' })).toBe(
      'http://localhost',
    );
  });

  test('coerces whole-value number', () => {
    expect(substituteEnvInString('${PORT:-4000}', {})).toBe(4000);
    expect(substituteEnvInString('${PORT}', { PORT: '3000' })).toBe(3000);
  });

  test('coerces whole-value boolean and null', () => {
    expect(substituteEnvInString('${FLAG:-true}', {})).toBe(true);
    expect(substituteEnvInString('${FLAG}', { FLAG: 'false' })).toBe(false);
    expect(substituteEnvInString('${X:-null}', {})).toBe(null);
  });

  test('does not coerce mid-string numbers', () => {
    expect(substituteEnvInString('v${VER}', { VER: '1' })).toBe('v1');
  });

  test('tracks missing vars without default', () => {
    const missing = [];
    expect(substituteEnvInString('${MISSING}', {}, missing)).toBe('');
    expect(missing).toContain('MISSING');
  });
});

describe('substituteEnvInConfig', () => {
  test('walks nested objects and arrays', () => {
    const { value, missing } = substituteEnvInConfig(
      {
        title: '${APP_TITLE:-Shell}',
        port: '${PORT:-4000}',
        backend: {
          url: '${BACKEND_URL:-https://id.example.com}',
          companyId: '${COMPANY_ID:-1}',
        },
        navigation: [{ label: 'Home', path: 'home', url: '${HOME_URL:-/}' }],
      },
      {
        BACKEND_URL: 'http://localhost:8000',
      },
    );

    expect(value).toEqual({
      title: 'Shell',
      port: 4000,
      backend: {
        url: 'http://localhost:8000',
        companyId: 1,
      },
      navigation: [{ label: 'Home', path: 'home', url: '/' }],
    });
    expect(missing).toEqual([]);
  });

  test('reports missing without defaults', () => {
    const { value, missing } = substituteEnvInConfig({ title: '${UNSET_TITLE}' }, {});
    expect(value).toEqual({ title: '' });
    expect(missing).toEqual(['UNSET_TITLE']);
  });
});

describe('prepareFrontendConfig', () => {
  test('freezes a plain snapshot and strips runtime', async () => {
    const { prepareFrontendConfig } = await import('../config-env.js');
    const frozen = prepareFrontendConfig({
      title: 'App',
      port: 4000,
      runtime: 'tauri',
      $schema: './x.json',
    });
    expect(frozen).toEqual({ title: 'App', port: 4000 });
    expect(frozen.runtime).toBeUndefined();
    expect(frozen.$schema).toBeUndefined();
  });

  test('rejects unresolved placeholders', async () => {
    const { prepareFrontendConfig } = await import('../config-env.js');
    // Simulate a value that still contains a placeholder (e.g. env value reintroduced one)
    expect(() => prepareFrontendConfig({ title: 'x', url: '${SHOULD_NOT_SHIP}' })).toThrow(
      /Unresolved environment placeholder/,
    );
  });

  test('writeGeneratedFrontendConfig writes resolved JSON', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { writeGeneratedFrontendConfig, GENERATED_FRONTEND_CONFIG_FILE } =
      await import('../config-env.js');
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-fixtures-gen-config');
    fs.mkdirSync(dir, { recursive: true });
    try {
      const { filePath, config } = writeGeneratedFrontendConfig(dir, {
        title: 'Built',
        backend: { type: 'shellui', url: 'https://id.example.com' },
      });
      expect(filePath).toBe(path.join(dir, GENERATED_FRONTEND_CONFIG_FILE));
      expect(config.title).toBe('Built');
      const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(onDisk).toEqual(config);
      expect(JSON.stringify(onDisk)).not.toMatch(/\$\{/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
