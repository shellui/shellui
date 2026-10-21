import { describe, expect, it } from 'vitest';
import type { ShellUIConfig } from '../../config/types';
import { listDistinctAppBackends, normalizeBackendUrl, resolveFrameAppBackend } from './identity';

const shellBackend = {
  type: 'shellui' as const,
  url: 'https://id.example.com/',
  companyId: 1,
  login: { oauthProviders: ['google'] },
};

function config(extra?: Partial<ShellUIConfig>): ShellUIConfig {
  return {
    backend: shellBackend,
    navigation: [
      {
        label: 'Billing',
        path: 'billing',
        url: 'https://billing.example/',
        safeForAuthToken: true,
      },
    ],
    ...extra,
  };
}

describe('normalizeBackendUrl', () => {
  it('drops a trailing slash and lowercases the host', () => {
    expect(normalizeBackendUrl('HTTPS://ID.Example.com/')).toBe('https://id.example.com');
  });

  it('rejects non-http URLs', () => {
    expect(normalizeBackendUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeBackendUrl('')).toBeNull();
  });
});

describe('resolveFrameAppBackend', () => {
  it('falls back to the shell backend when the item has no override', () => {
    expect(resolveFrameAppBackend('https://billing.example/', config())).toEqual({ kind: 'shell' });
  });

  it('falls back when the override URL is the shell server, including a trailing slash', () => {
    const next = config({
      navigation: [
        {
          label: 'Billing',
          path: 'billing',
          url: 'https://billing.example/',
          safeForAuthToken: true,
          backend: { url: 'https://id.example.com/' },
        },
      ],
    });
    expect(resolveFrameAppBackend('https://billing.example/app', next)).toEqual({ kind: 'shell' });
  });

  it('falls back when companyId is omitted on the same server', () => {
    const next = config({
      navigation: [
        {
          label: 'Billing',
          path: 'billing',
          url: 'https://billing.example/',
          backend: { url: 'https://id.example.com', type: 'shellui' },
        },
      ],
    });
    expect(resolveFrameAppBackend('https://billing.example/', next).kind).toBe('shell');
  });

  it('treats a different URL as a foreign identity server', () => {
    const next = config({
      navigation: [
        {
          label: 'Directory',
          path: 'directory',
          url: 'https://directory.example/',
          safeForAuthToken: true,
          backend: { url: 'https://id.directory.example/', companyId: 4, provider: 'Google' },
        },
      ],
    });
    const resolved = resolveFrameAppBackend('https://directory.example/people', next);
    expect(resolved.kind).toBe('foreign');
    if (resolved.kind !== 'foreign') return;
    expect(resolved.identity.url).toBe('https://id.directory.example');
    expect(resolved.identity.companyId).toBe(4);
    expect(resolved.identity.provider).toBe('google');
    expect(resolved.identity.key).not.toContain('https://id.example.com');
  });

  it('treats a different company id on the same URL as a foreign server', () => {
    const next = config({
      navigation: [
        {
          label: 'Directory',
          path: 'directory',
          url: 'https://directory.example/',
          backend: { url: 'https://id.example.com', companyId: 9 },
        },
      ],
    });
    expect(resolveFrameAppBackend('https://directory.example/', next).kind).toBe('foreign');
  });

  it('withholds the shell session when the override URL cannot be used', () => {
    const next = config({
      navigation: [
        {
          label: 'Directory',
          path: 'directory',
          url: 'https://directory.example/',
          backend: { url: 'not a url' },
        },
      ],
    });
    expect(resolveFrameAppBackend('https://directory.example/', next)).toEqual({
      kind: 'withhold',
    });
  });

  it('lets a more specific item without a backend keep the shell session', () => {
    const next = config({
      navigation: [
        {
          label: 'Apps',
          path: 'apps',
          url: 'https://apps.example/',
          backend: { url: 'https://id.other.example' },
        },
        {
          label: 'Billing',
          path: 'billing',
          url: 'https://apps.example/billing',
          safeForAuthToken: true,
        },
      ],
    });
    expect(resolveFrameAppBackend('https://apps.example/billing/invoices', next).kind).toBe(
      'shell',
    );
    expect(resolveFrameAppBackend('https://apps.example/other', next).kind).toBe('foreign');
  });

  it('ignores external items and reads administration items', () => {
    const next = config({
      navigation: [
        {
          label: 'Away',
          path: 'away',
          url: 'https://directory.example/',
          openIn: 'external',
          backend: { url: 'https://id.external.example' },
        },
      ],
      administration: {
        title: 'Admin',
        navigation: [
          {
            label: 'Directory',
            path: 'directory',
            url: 'https://directory.example/',
            backend: { url: 'https://id.directory.example' },
          },
        ],
      },
    });
    const resolved = resolveFrameAppBackend('https://directory.example/', next);
    expect(resolved.kind).toBe('foreign');
    if (resolved.kind !== 'foreign') return;
    expect(resolved.identity.url).toBe('https://id.directory.example');
  });

  it('lists each foreign server once', () => {
    const next = config({
      navigation: [
        {
          label: 'One',
          path: 'one',
          url: 'https://one.example/',
          backend: { url: 'https://id.other.example' },
        },
        {
          label: 'Two',
          path: 'two',
          url: 'https://two.example/',
          backend: { url: 'https://id.other.example/' },
        },
        {
          label: 'Billing',
          path: 'billing',
          url: 'https://billing.example/',
        },
      ],
    });
    expect(listDistinctAppBackends(next).map((item) => item.url)).toEqual([
      'https://id.other.example',
    ]);
  });
});
