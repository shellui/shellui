import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const schemaPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../schemas/shellui.config.schema.json',
);

describe('shellui.config schema app backend', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as {
    definitions: Record<
      string,
      {
        properties?: Record<string, unknown>;
        required?: string[];
        additionalProperties?: boolean;
      }
    >;
  };

  it('adds an optional per-app backend and keeps existing item fields', () => {
    const navigationItem = schema.definitions.NavigationItem;
    const appBackend = schema.definitions.AppBackendConfig;
    expect(navigationItem.additionalProperties).toBe(false);
    expect(navigationItem.required).toEqual(['label', 'path', 'url']);
    expect(navigationItem.properties?.backend).toBeTruthy();
    expect(navigationItem.properties?.email).toBeTruthy();
    expect(navigationItem.properties?.storage).toBeTruthy();
    expect(navigationItem.properties?.hosting).toBeTruthy();
    expect(navigationItem.properties?.safeForAuthToken).toBeTruthy();
    expect(appBackend.additionalProperties).toBe(false);
    expect(appBackend.required).toEqual(['url']);
    expect(appBackend.properties?.url).toBeTruthy();
    expect(appBackend.properties?.type).toBeTruthy();
    expect(appBackend.properties?.companyId).toBeTruthy();
    expect(appBackend.properties?.provider).toBeTruthy();
    expect(appBackend.properties?.publishableKey).toBeTruthy();
  });
});
