import { describe, expect, it, vi } from 'vitest';
import {
  NavigationOverlayConflictError,
  createNavigationStorageAdapter,
  navigationLayoutStorageKey,
  resolveNavigationOverlayUrl,
  resolveTrustedNavigationOverlayUrl,
} from './storage';
import { emptyNavigationOverlay, type NavigationOverlay } from './overlay';

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, value),
  };
}

const sample = (): NavigationOverlay => ({
  ...emptyNavigationOverlay('2026-01-01T00:00:00.000Z'),
  installedApps: [
    {
      id: 'notes',
      name: 'Notes',
      origin: 'https://notes.example',
      url: 'https://notes.example/',
      path: 'notes',
      thirdParty: true,
      capabilities: ['theme', 'locale'],
      installedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
});

describe('navigation storage adapters', () => {
  it('resolves the identity navigation overlay endpoint', () => {
    expect(resolveNavigationOverlayUrl({ identityBaseUrl: 'https://id.example.com/' })).toBe(
      'https://id.example.com/api/v1/navigation-overlay',
    );
    expect(
      resolveNavigationOverlayUrl({
        apiUrl: 'https://id.example.com/api/v1/navigation-overlay',
      }),
    ).toBe('https://id.example.com/api/v1/navigation-overlay');
  });

  it('round-trips localStorage and resets it', async () => {
    const storage = memory();
    const adapter = createNavigationStorageAdapter({
      mode: 'localStorage',
      identityConfigured: true,
      isSignedIn: () => true,
      getAccessToken: () => 'token',
      storage,
    });
    await adapter.save(sample());
    await expect(adapter.load()).resolves.toMatchObject({
      installedApps: [expect.objectContaining({ id: 'notes' })],
    });
    await adapter.reset?.();
    await expect(adapter.load()).resolves.toBeNull();
  });

  it('uses identity when auto mode is signed in, and localStorage otherwise', async () => {
    const storage = memory();
    let signedIn = false;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') return new Response('null', { status: 404 });
      if (method === 'PUT') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer token' });
        expect(String(input)).toBe('https://id.example/api/v1/navigation-overlay');
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 204 });
    });
    const adapter = createNavigationStorageAdapter({
      mode: 'auto',
      identityConfigured: true,
      isSignedIn: () => signedIn,
      getAccessToken: () => (signedIn ? 'token' : null),
      identityBaseUrl: 'https://id.example',
      storage,
      fetchImpl: fetchImpl as typeof fetch,
    });

    await adapter.save(sample());
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(adapter.load()).resolves.toMatchObject({
      installedApps: [expect.objectContaining({ id: 'notes' })],
    });

    signedIn = true;
    fetchImpl.mockImplementation(async (_input, init) => {
      if ((init?.method ?? 'GET') === 'PUT') {
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token');
      }
      if ((init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify(sample()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(null, { status: 204 });
    });
    await adapter.save(sample());
    await expect(adapter.load()).resolves.toMatchObject({
      installedApps: [expect.objectContaining({ id: 'notes' })],
    });
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('falls back to localStorage when the identity request fails', async () => {
    const storage = memory();
    await createNavigationStorageAdapter({
      mode: 'localStorage',
      identityConfigured: false,
      isSignedIn: () => false,
      getAccessToken: () => null,
      storage,
    }).save(sample());

    const adapter = createNavigationStorageAdapter({
      mode: 'auto',
      identityConfigured: true,
      isSignedIn: () => true,
      getAccessToken: () => 'token',
      identityBaseUrl: 'https://id.example',
      storage,
      fetchImpl: vi.fn(async () => {
        throw new Error('offline');
      }) as typeof fetch,
    });
    await expect(adapter.load()).resolves.toMatchObject({
      installedApps: [expect.objectContaining({ id: 'notes' })],
    });
  });
});

describe('one layout per user and company', () => {
  it('keeps a separate localStorage layout for each user and company', async () => {
    const storage = memory();
    let scope = { userId: 'u1', companyId: '10' };
    const adapter = createNavigationStorageAdapter({
      mode: 'localStorage',
      identityConfigured: false,
      isSignedIn: () => true,
      getAccessToken: () => null,
      storage,
      scope: () => scope,
    });
    await adapter.save(sample());
    scope = { userId: 'u1', companyId: '11' };
    await expect(adapter.load()).resolves.toBeNull();
    scope = { userId: 'u2', companyId: '10' };
    await expect(adapter.load()).resolves.toBeNull();
    scope = { userId: 'u1', companyId: '10' };
    await expect(adapter.load()).resolves.toMatchObject({
      installedApps: [expect.objectContaining({ id: 'notes' })],
    });
    expect(navigationLayoutStorageKey({ userId: 'u1', companyId: '10' })).not.toBe(
      navigationLayoutStorageKey({ userId: 'u1', companyId: '11' }),
    );
    expect(navigationLayoutStorageKey({ userId: null, companyId: '10' })).toBe(
      navigationLayoutStorageKey(null),
    );
  });

  it('never uploads the device layout when the person signs in', async () => {
    const storage = memory();
    await createNavigationStorageAdapter({
      mode: 'localStorage',
      identityConfigured: false,
      isSignedIn: () => false,
      getAccessToken: () => null,
      storage,
    }).save(sample());

    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET'
        ? new Response('null', { status: 404 })
        : new Response(null, { status: 204 }),
    );
    const adapter = createNavigationStorageAdapter({
      mode: 'auto',
      identityConfigured: true,
      isSignedIn: () => true,
      getAccessToken: () => 'token',
      identityBaseUrl: 'https://id.example',
      scope: () => ({ userId: 'u1', companyId: '10' }),
      storage,
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(adapter.load()).resolves.toBeNull();
    const methods = fetchImpl.mock.calls.map(([, init]) => init?.method ?? 'GET');
    expect(methods).toEqual(['GET']);
  });

  it('sends If-Match with the last ETag and surfaces a conflict', async () => {
    const storage = memory();
    const seen: Array<Record<string, string>> = [];
    let putStatus = 204;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ method: init?.method ?? 'GET', ...(init?.headers as Record<string, string>) });
      if ((init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify({ overlay: sample() }), {
          status: 200,
          headers: { ETag: '"v1"' },
        });
      }
      return new Response(null, { status: putStatus, headers: { ETag: '"v2"' } });
    });
    const adapter = createNavigationStorageAdapter({
      mode: 'api',
      identityConfigured: true,
      isSignedIn: () => true,
      getAccessToken: () => 'token',
      identityBaseUrl: 'https://id.example',
      scope: () => ({ userId: 'u1', companyId: '10' }),
      storage,
      fetchImpl: fetchImpl as typeof fetch,
    });
    await adapter.load();
    await adapter.save(sample());
    expect(seen[1]).toMatchObject({ method: 'PUT', 'If-Match': '"v1"' });
    await adapter.save(sample());
    expect(seen[2]).toMatchObject({ 'If-Match': '"v2"' });
    putStatus = 412;
    // A conflict is surfaced, not hidden behind the device copy.
    await expect(adapter.save(sample())).rejects.toBeInstanceOf(NavigationOverlayConflictError);
    const key = navigationLayoutStorageKey({ userId: 'u1', companyId: '10' });
    expect(storage.getItem(key)).toBeNull();
  });
});

describe('layout API URL', () => {
  it('is https on a known origin before it gets a token', () => {
    const identityBaseUrl = 'https://id.example';
    expect(resolveTrustedNavigationOverlayUrl({ identityBaseUrl })).toBe(
      'https://id.example/api/v1/navigation-overlay',
    );
    expect(
      resolveTrustedNavigationOverlayUrl({ identityBaseUrl, apiUrl: 'https://evil.example/' }),
    ).toBeNull();
    expect(resolveTrustedNavigationOverlayUrl({ identityBaseUrl: 'http://id.example' })).toBeNull();
    expect(
      resolveTrustedNavigationOverlayUrl({ identityBaseUrl: 'http://localhost:8000' }),
    ).toBeNull();
    expect(
      resolveTrustedNavigationOverlayUrl({
        identityBaseUrl: 'http://localhost:8000',
        allowLocalhost: true,
      }),
    ).toBe('http://localhost:8000/api/v1/navigation-overlay');
    expect(
      resolveTrustedNavigationOverlayUrl({
        identityBaseUrl,
        apiUrl: 'https://api.id.example/api/v1/navigation-overlay',
        knownApiOrigins: ['https://api.id.example'],
      }),
    ).toBe('https://api.id.example/api/v1/navigation-overlay');
  });

  it('never sends the token to an unknown origin', async () => {
    const fetchImpl = vi.fn(async () => new Response('null', { status: 404 }));
    const adapter = createNavigationStorageAdapter({
      mode: 'api',
      identityConfigured: true,
      isSignedIn: () => true,
      getAccessToken: () => 'token',
      identityBaseUrl: 'https://id.example',
      apiUrl: 'https://evil.example',
      storage: memory(),
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(adapter.load()).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('stored layouts use the shared validator', () => {
  it('drops a saved app on a reserved path or the shell origin when it loads', async () => {
    const storage = memory();
    const base = sample().installedApps[0];
    storage.setItem(
      navigationLayoutStorageKey(null),
      JSON.stringify({
        ...sample(),
        installedApps: [
          base,
          { ...base, id: 'admin-app', path: 'admin' },
          { ...base, id: 'files-app', path: 'files/x' },
          {
            ...base,
            id: 'self',
            path: 'self',
            url: 'https://shell.example/x',
            origin: 'https://shell.example',
          },
        ],
      }),
    );
    const adapter = createNavigationStorageAdapter({
      mode: 'localStorage',
      identityConfigured: false,
      isSignedIn: () => false,
      getAccessToken: () => null,
      storage,
      validation: () => ({ now: '2026-01-01T00:00:00.000Z', shellOrigin: 'https://shell.example' }),
    });
    const loaded = await adapter.load();
    expect(loaded?.installedApps.map((app) => app.id)).toEqual(['notes']);
  });

  it('ignores a stored layout over the size limit', async () => {
    const storage = memory();
    storage.setItem(
      navigationLayoutStorageKey(null),
      JSON.stringify({ ...sample(), pad: 'x'.repeat(70000) }),
    );
    const adapter = createNavigationStorageAdapter({
      mode: 'localStorage',
      identityConfigured: false,
      isSignedIn: () => false,
      getAccessToken: () => null,
      storage,
    });
    await expect(adapter.load()).resolves.toBeNull();
  });
});
