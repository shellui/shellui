import { describe, expect, it } from 'vitest';
import { cleanAppName, prepareInstall } from './installApp';
import {
  THIRD_PARTY_IFRAME_SANDBOX,
  isAllowedThirdPartyFrameUrl,
  resolveContentFramePolicy,
} from './framePolicy';
import { isUnsafeNavIconSrc, safeRemoteIconUrl } from './icons';
import { clearInstalledAppRecords, replaceInstalledAppRecords } from './installedAppRegistry';

const validation = {
  now: '2026-01-01T00:00:00.000Z',
  shellOrigin: 'https://shell.example',
  staticOrigins: new Set<string>(['https://home.example']),
  reservedPaths: ['/admin', '/__settings', '/files'],
};

const baseOptions = {
  allowThirdParty: true,
  validation,
  takenPaths: new Set<string>(['home']),
};

const notes = {
  id: 'notes',
  name: 'Notes',
  url: 'https://notes.example/app',
  capabilities: ['theme', 'locale'],
};

describe('prepareInstall', () => {
  it('asks for confirmation and grants only theme and locale by default', () => {
    const prepared = prepareInstall(notes, baseOptions);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.needsConfirmation).toBe(true);
    expect(prepared.record.thirdParty).toBe(true);
    expect(prepared.record.capabilities).toEqual(['theme', 'locale']);
    expect(prepared.record).not.toHaveProperty('safeForAuthToken');
    expect(prepared.summary.origin).toBe('https://notes.example');
    expect(prepared.summary.update).toBe(false);
  });

  it('drops spoofed auth and child frames, and lists the grantable extras', () => {
    const prepared = prepareInstall(
      {
        ...notes,
        thirdParty: true,
        capabilities: ['ui', 'storage', 'auth', 'childFrames'],
        safeForAuthToken: true,
        childFrames: { origins: ['https://evil.example'] },
      },
      baseOptions,
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.record.capabilities).toEqual(['theme', 'locale', 'ui', 'storage']);
    expect(prepared.summary.deniedPrivileged).toBe(true);
    expect(prepared.needsConfirmation).toBe(true);
  });

  it('ignores the catalog thirdParty flag: a record that claims to be first-party is still third-party', () => {
    const prepared = prepareInstall(
      { ...notes, thirdParty: false, url: 'https://apps.shellui.com/official' },
      baseOptions,
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.needsConfirmation).toBe(true);
    expect(prepared.record.thirdParty).toBe(true);
    expect(prepared.record.capabilities).toEqual(['theme', 'locale']);
  });

  it('always runs the origin checks', () => {
    for (const thirdParty of [true, false, undefined]) {
      expect(
        prepareInstall(
          { id: 'x', name: 'X', url: 'https://home.example/extra', thirdParty },
          baseOptions,
        ),
      ).toMatchObject({ ok: false, error: 'origin_in_use' });
      expect(
        prepareInstall(
          { id: 'x', name: 'X', url: 'https://shell.example/app', thirdParty },
          baseOptions,
        ),
      ).toMatchObject({ ok: false, error: 'origin_in_use' });
    }
  });

  it('rejects http, localhost in a production build, and disabled third-party installs', () => {
    expect(
      prepareInstall({ id: 'x', name: 'X', url: 'http://notes.example/' }, baseOptions),
    ).toMatchObject({ ok: false, error: 'invalid_request' });
    expect(
      prepareInstall({ id: 'x', name: 'Local', url: 'http://localhost:5173/' }, baseOptions),
    ).toMatchObject({ ok: false, error: 'localhost_not_allowed' });
    expect(
      prepareInstall(
        { id: 'x', name: 'Local', url: 'http://localhost:5173/' },
        { ...baseOptions, validation: { ...validation, allowLocalhost: true } },
      ).ok,
    ).toBe(true);
    expect(
      prepareInstall({ id: 'x', name: 'X', url: 'https://192.168.1.4/' }, baseOptions),
    ).toMatchObject({ ok: false });
    expect(prepareInstall(notes, { ...baseOptions, allowThirdParty: false })).toMatchObject({
      ok: false,
      error: 'third_party_disabled',
    });
  });

  it('refuses reserved and traversing paths', () => {
    for (const path of [
      'admin',
      'Admin/users',
      '__settings',
      'legal/privacy-policy',
      'files',
      'login',
      'settings',
      'marketplace',
      '../etc',
      'a/../b',
      '%2e%2e/x',
    ]) {
      expect(prepareInstall({ ...notes, path }, baseOptions)).toMatchObject({ ok: false });
    }
    expect(prepareInstall({ ...notes, path: 'adminx' }, baseOptions)).toMatchObject({ ok: true });
  });

  it('takes an unused path next to a static one', () => {
    const prepared = prepareInstall({ ...notes, path: 'home' }, baseOptions);
    expect(prepared.ok && prepared.record.path).toBe('home-2');
  });

  it('asks again when an installed id changes origin, url, or capabilities', () => {
    const first = prepareInstall(notes, baseOptions);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    for (const change of [
      { url: 'https://other.example/app' },
      { url: 'https://notes.example/different' },
      { capabilities: ['theme', 'locale', 'storage'] },
    ]) {
      const next = prepareInstall(
        { ...notes, ...change },
        { ...baseOptions, existing: first.record },
      );
      expect(next.ok).toBe(true);
      if (!next.ok) continue;
      expect(next.needsConfirmation).toBe(true);
      expect(next.summary.update).toBe(true);
      expect(next.record.path).toBe(first.record.path);
      expect(next.record.installedAt).toBe(first.record.installedAt);
    }
  });
});

describe('cleanAppName', () => {
  it('removes hidden characters and refuses names that pass as the shell', () => {
    expect(cleanAppName('  Not\u200bes\u202e  ')).toBe('Notes');
    expect(cleanAppName('Shellui Security')).toBeNull();
    expect(cleanAppName('\uFF33hellui Settings')).toBeNull();
    expect(cleanAppName('Settings')).toBeNull();
    expect(cleanAppName('Admin')).toBeNull();
    expect(cleanAppName('Admin Tools')).toBe('Admin Tools');
    expect(cleanAppName('x'.repeat(81))).toBeNull();
    expect(cleanAppName(42)).toBeNull();
  });
});

describe('third-party frame policy', () => {
  it('uses a strict sandbox, no referrer, and an empty allow list', () => {
    const prepared = prepareInstall(notes, baseOptions);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) replaceInstalledAppRecords([prepared.record]);
    expect(THIRD_PARTY_IFRAME_SANDBOX).not.toContain('allow-top-navigation');
    expect(THIRD_PARTY_IFRAME_SANDBOX).not.toContain('allow-popups');
    expect(THIRD_PARTY_IFRAME_SANDBOX).not.toContain('allow-modals');
    const policy = resolveContentFramePolicy('https://notes.example/app', { thirdParty: true });
    expect(policy).toMatchObject({
      sandbox: THIRD_PARTY_IFRAME_SANDBOX,
      referrerPolicy: 'no-referrer',
      allow: '',
      permitted: true,
    });
    expect(isAllowedThirdPartyFrameUrl('http://notes.example/')).toBe(false);
    expect(isAllowedThirdPartyFrameUrl('http://localhost:5173/')).toBe(false);
    expect(isAllowedThirdPartyFrameUrl('javascript:alert(1)')).toBe(false);
    clearInstalledAppRecords();
  });

  it('renders a third-party frame only for an installed origin', () => {
    clearInstalledAppRecords();
    expect(isAllowedThirdPartyFrameUrl('https://notes.example/app')).toBe(false);
    replaceInstalledAppRecords([
      {
        id: 'notes',
        name: 'Notes',
        origin: 'https://notes.example',
        url: 'https://notes.example/app',
        path: 'notes',
        thirdParty: true,
        capabilities: ['theme', 'locale'],
        installedAt: validation.now,
        updatedAt: validation.now,
      },
    ]);
    expect(isAllowedThirdPartyFrameUrl('https://notes.example/app/deep')).toBe(true);
    expect(isAllowedThirdPartyFrameUrl('https://evil.example/app')).toBe(false);
    clearInstalledAppRecords();
  });

  it('keeps the existing sandbox for first-party frames', () => {
    const policy = resolveContentFramePolicy('https://docs.example/', {
      thirdParty: false,
      shellOrigin: 'https://shell.example',
    });
    expect(policy.referrerPolicy).toBe('no-referrer-when-downgrade');
    expect(policy.allow).toBeUndefined();
    expect(policy.sandbox).not.toContain('allow-top-navigation');
  });
});

describe('nav icons', () => {
  it('refuses inline SVG and accepts remote https URLs', () => {
    expect(isUnsafeNavIconSrc('<svg><script>alert(1)</script></svg>')).toBe(true);
    expect(isUnsafeNavIconSrc('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true);
    expect(safeRemoteIconUrl('https://cdn.example/icon.png')).toBe('https://cdn.example/icon.png');
    expect(safeRemoteIconUrl('<svg></svg>')).toBeUndefined();
  });
});
