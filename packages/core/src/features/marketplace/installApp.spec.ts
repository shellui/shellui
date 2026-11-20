import { describe, expect, it } from 'vitest';
import { prepareInstall } from './installApp';
import {
  THIRD_PARTY_IFRAME_SANDBOX,
  isAllowedThirdPartyFrameUrl,
  resolveContentFramePolicy,
} from './framePolicy';
import { isUnsafeNavIconSrc, safeRemoteIconUrl } from './icons';

const baseOptions = {
  allowThirdParty: true,
  now: '2026-01-01T00:00:00.000Z',
  takenPaths: new Set<string>(['home']),
  staticOrigins: new Set<string>(['https://home.example']),
  shellOrigin: 'https://shell.example',
};

describe('prepareInstall', () => {
  it('asks for confirmation and grants only theme and locale by default', () => {
    const prepared = prepareInstall(
      {
        id: 'notes',
        name: 'Notes',
        url: 'https://notes.example/app',
        capabilities: ['theme', 'locale'],
      },
      baseOptions,
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.needsConfirmation).toBe(true);
    expect(prepared.record.thirdParty).toBe(true);
    expect(prepared.record.capabilities).toEqual(['theme', 'locale']);
    expect(prepared.record).not.toHaveProperty('safeForAuthToken');
    expect(prepared.summary.origin).toBe('https://notes.example');
  });

  it('drops spoofed auth and child frames, and lists the grantable extras', () => {
    const prepared = prepareInstall(
      {
        id: 'notes',
        name: 'Notes',
        url: 'https://notes.example/app',
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

  it('rejects a third-party app on an origin the shell already uses', () => {
    expect(
      prepareInstall({ id: 'x', name: 'X', url: 'https://home.example/extra' }, baseOptions),
    ).toMatchObject({ ok: false, error: 'origin_in_use' });
    expect(
      prepareInstall({ id: 'x', name: 'X', url: 'https://shell.example/app' }, baseOptions),
    ).toMatchObject({ ok: false, error: 'origin_in_use' });
  });

  it('rejects http except localhost, and third-party installs when they are disabled', () => {
    expect(
      prepareInstall({ id: 'x', name: 'X', url: 'http://notes.example/' }, baseOptions),
    ).toMatchObject({ ok: false, error: 'invalid_request' });
    const local = prepareInstall(
      { id: 'x', name: 'Local', url: 'http://localhost:5173/' },
      baseOptions,
    );
    expect(local.ok).toBe(true);
    expect(
      prepareInstall(
        { id: 'x', name: 'X', url: 'https://notes.example/' },
        { ...baseOptions, allowThirdParty: false },
      ),
    ).toMatchObject({ ok: false, error: 'third_party_disabled' });
  });

  it('installs a first-party app with only theme and locale without a dialog', () => {
    const prepared = prepareInstall(
      {
        id: 'official',
        name: 'Official',
        url: 'https://apps.shellui.com/official',
        thirdParty: false,
      },
      baseOptions,
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.needsConfirmation).toBe(false);
    expect(prepared.record.capabilities).toEqual(['theme', 'locale']);
    expect(prepared.record.thirdParty).toBe(false);
  });
});

describe('third-party frame policy', () => {
  it('uses a strict sandbox, no referrer, and an empty allow list', () => {
    expect(THIRD_PARTY_IFRAME_SANDBOX).not.toContain('allow-top-navigation');
    const policy = resolveContentFramePolicy('https://notes.example/app', { thirdParty: true });
    expect(policy).toMatchObject({
      sandbox: THIRD_PARTY_IFRAME_SANDBOX,
      referrerPolicy: 'no-referrer',
      allow: '',
      permitted: true,
    });
    expect(isAllowedThirdPartyFrameUrl('http://notes.example/')).toBe(false);
    expect(isAllowedThirdPartyFrameUrl('http://localhost:5173/')).toBe(true);
    expect(isAllowedThirdPartyFrameUrl('javascript:alert(1)')).toBe(false);
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
