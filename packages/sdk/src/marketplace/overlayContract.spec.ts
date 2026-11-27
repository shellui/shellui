import { describe, expect, it } from 'vitest';
import example from '../../schemas/shell-navigation-overlay.v1.example.json';
import schema from '../../schemas/navigation-overlay.v1.json';
import {
  OVERLAY_LIMITS,
  RESERVED_PATH_SEGMENTS,
  THIRD_PARTY_CAPABILITIES,
  hasPathTraversal,
  isPrivateOrLoopbackHost,
  isReservedAppPath,
  validateInstalledApp,
  validateNavigationOverlay,
} from './overlayContract.js';

const context = { now: '2026-01-01T00:00:00.000Z', shellOrigin: 'https://shell.example' };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The same schema and example live in identity-service (`apps/authapi/schemas/`). Its own
 * contract test validates the example with its validator. This one does the same with the
 * shell validator, so both ends accept and refuse the same documents.
 */
describe('navigation overlay contract (shared with identity-service)', () => {
  const app = schema.$defs.installedApp;

  it('accepts the shared shell example, strictly and unchanged', () => {
    const result = validateNavigationOverlay(example, context, { strict: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dropped).toBe(0);
    expect(result.overlay.installedApps[0]).toEqual(example.installedApps[0]);
    expect(result.overlay.order).toEqual(example.order);
    expect(result.overlay.hiddenPaths).toEqual(example.hiddenPaths);
  });

  it('matches the schema constants', () => {
    expect(schema.properties.installedApps.maxItems).toBe(OVERLAY_LIMITS.maxApps);
    expect(schema.properties.order.maxItems).toBe(OVERLAY_LIMITS.maxOrder);
    expect(schema.properties.hiddenPaths.maxItems).toBe(OVERLAY_LIMITS.maxHiddenPaths);
    expect(app.properties.id.maxLength).toBe(OVERLAY_LIMITS.maxIdLength);
    expect(app.properties.name.maxLength).toBe(OVERLAY_LIMITS.maxNameLength);
    expect(app.properties.url.maxLength).toBe(OVERLAY_LIMITS.maxUrlLength);
    expect(app.properties.path.maxLength).toBe(OVERLAY_LIMITS.maxPathLength);
    expect(app.properties.thirdParty).toEqual({ const: true });
    expect(app.additionalProperties).toBe(false);
    expect([...app.properties.capabilities.items.enum].sort()).toEqual(
      [...THIRD_PARTY_CAPABILITIES].sort(),
    );
    expect(app.properties.capabilities.items.enum).not.toContain('auth');
    for (const segment of RESERVED_PATH_SEGMENTS) {
      expect(app.properties.path.description).toContain(segment);
    }
    expect(app.required).toEqual(
      expect.arrayContaining(['id', 'name', 'origin', 'url', 'path', 'thirdParty', 'capabilities']),
    );
  });

  it('refuses what identity-service refuses', () => {
    const base = example.installedApps[0];
    const strict = (value: unknown) =>
      validateNavigationOverlay({ ...clone(example), installedApps: [value] }, context, {
        strict: true,
      });
    expect(strict({ ...base, capabilities: ['theme', 'auth'] })).toMatchObject({
      ok: false,
      error: 'auth_not_allowed',
    });
    expect(strict({ ...base, thirdParty: false }).ok).toBe(false);
    expect(strict({ ...base, firstParty: true }).ok).toBe(false);
    expect(strict({ ...base, safeForAuthToken: true }).ok).toBe(false);
    expect(
      validateNavigationOverlay({ ...clone(example), extra: 1 }, context, { strict: true }).ok,
    ).toBe(false);
    // Read leniently, a stray key is ignored and never copied.
    const lenient = validateInstalledApp({ ...base, firstParty: true }, context);
    expect(lenient.ok && 'firstParty' in lenient.app).toBe(false);
    expect(
      strict({ ...base, url: 'http://notes.example.com/app', origin: 'http://notes.example.com' })
        .ok,
    ).toBe(false);
    expect(strict({ ...base, url: 'https://127.0.0.1/app', origin: 'https://127.0.0.1' }).ok).toBe(
      false,
    );
    expect(
      strict({ ...base, url: 'https://shell.example/app', origin: 'https://shell.example' }),
    ).toMatchObject({
      ok: false,
      error: 'origin_in_use',
    });
    expect(strict({ ...base, origin: 'https://other.example.com' }).ok).toBe(false);
    for (const path of [
      'admin',
      'Admin/x',
      '__settings',
      'legal/terms',
      'files',
      'login',
      'marketplace',
      'settings',
      '../x',
      'a/..',
      '/a//b',
    ]) {
      expect(strict({ ...base, path }).ok).toBe(false);
    }
  });

  it('caps the document at 100 apps and 64 KB, whether strict or not', () => {
    const many = Array.from({ length: 101 }, (_, n) => ({
      ...example.installedApps[0],
      id: `app-${n}`,
      path: `app-${n}`,
    }));
    expect(
      validateNavigationOverlay({ ...clone(example), installedApps: many }, context),
    ).toMatchObject({
      ok: false,
      error: 'too_many_apps',
    });
    const paths = Array.from({ length: 200 }, (_, n) => `p${n}${'x'.repeat(190)}`);
    const big = { ...clone(example), order: paths, hiddenPaths: paths.map((path) => `h${path}`) };
    expect(validateNavigationOverlay(big, context)).toMatchObject({
      ok: false,
      error: 'too_large',
    });
  });

  it('keeps the good apps and counts the bad ones when not strict', () => {
    const doc = {
      ...clone(example),
      installedApps: [
        example.installedApps[0],
        { ...example.installedApps[0], id: 'evil', path: 'admin' },
      ],
    };
    const result = validateNavigationOverlay(doc, context);
    expect(result.ok && result.overlay.installedApps.map((entry) => entry.id)).toEqual(['notes']);
    expect(result.ok && result.dropped).toBe(1);
  });
});

describe('reserved paths and hosts', () => {
  it('reserves core segments in any case, plus shell extras and anything starting with __', () => {
    expect(isReservedAppPath('ADMIN/users')).toBe(true);
    expect(isReservedAppPath('__cookie-preferences')).toBe(true);
    expect(isReservedAppPath('notes')).toBe(false);
    expect(isReservedAppPath('console/x', ['/console'])).toBe(true);
    expect(isReservedAppPath('adminx')).toBe(false);
  });

  it('flags traversal in every encoding the shell cares about', () => {
    for (const value of ['..', 'a/../b', './a', 'a\\b', '%2e%2e/a', 'a%2Fb']) {
      expect(hasPathTraversal(value)).toBe(true);
    }
    expect(hasPathTraversal('a/b-c_d')).toBe(false);
  });

  it('treats loopback, private, and internal hosts as private', () => {
    for (const host of [
      'localhost',
      '127.0.0.1',
      '[::1]',
      '10.0.0.4',
      '172.20.1.1',
      '192.168.0.9',
      '169.254.1.1',
      'db.internal',
      'printer.local',
      'fd00::1',
    ]) {
      expect(isPrivateOrLoopbackHost(host)).toBe(true);
    }
    for (const host of ['notes.example.com', '8.8.8.8', '172.32.0.1']) {
      expect(isPrivateOrLoopbackHost(host)).toBe(false);
    }
  });

  it('accepts localhost only when development allows it', () => {
    const local = {
      ...clone(example.installedApps[0]),
      url: 'http://localhost:5173/',
      origin: 'http://localhost:5173',
    };
    expect(validateInstalledApp(local, context)).toMatchObject({
      ok: false,
      error: 'localhost_not_allowed',
    });
    expect(validateInstalledApp(local, { ...context, allowLocalhost: true }).ok).toBe(true);
  });
});
