import { describe, expect, it, vi } from 'vitest';
import { handleStorageRequest } from './handleRequest';

describe('handleStorageRequest', () => {
  it('returns 503 when storage is not configured', async () => {
    await expect(
      handleStorageRequest({
        storageUrl: null,
        accessToken: 'token',
        payload: { id: 'req-1', op: 'listBuckets' },
      }),
    ).resolves.toEqual({
      id: 'req-1',
      error: { message: 'Storage is not configured', status: 503 },
    });
  });

  it('returns 401 when the user is not signed in', async () => {
    await expect(
      handleStorageRequest({
        storageUrl: 'http://localhost:8001',
        accessToken: null,
        payload: { id: 'req-2', op: 'listBuckets' },
      }),
    ).resolves.toEqual({
      id: 'req-2',
      error: { message: 'Not authenticated', status: 401 },
    });
  });

  it('returns 400 for an invalid payload', async () => {
    await expect(
      handleStorageRequest({
        storageUrl: 'http://localhost:8001',
        accessToken: 'token',
        payload: { id: '', op: 'listBuckets' },
      }),
    ).resolves.toMatchObject({
      error: { status: 400 },
    });
  });

  it('returns data from a successful operation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => [{ name: 'company' }],
      }),
    );
    await expect(
      handleStorageRequest({
        storageUrl: 'http://localhost:8001',
        accessToken: 'token',
        payload: { id: 'req-3', op: 'listBuckets' },
      }),
    ).resolves.toEqual({
      id: 'req-3',
      data: [{ name: 'company' }],
    });
    vi.unstubAllGlobals();
  });

  it('maps storage-service errors onto the response payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'Denied' }),
      }),
    );
    await expect(
      handleStorageRequest({
        storageUrl: 'http://localhost:8001',
        accessToken: 'token',
        payload: { id: 'req-4', op: 'listBuckets' },
      }),
    ).resolves.toEqual({
      id: 'req-4',
      error: { message: 'Denied', status: 403 },
    });
    vi.unstubAllGlobals();
  });
});
