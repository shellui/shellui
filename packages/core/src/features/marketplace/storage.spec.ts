import { describe, expect, it, vi } from 'vitest';
import { createNavigationStorageAdapter, resolveNavigationOverlayUrl } from './storage';
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
