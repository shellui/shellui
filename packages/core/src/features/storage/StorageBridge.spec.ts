import { describe, expect, it, vi } from 'vitest';
import type { ShellUIConfig } from '../config/types';
import { getStorageRequestTrustDenial } from '../security/trustedFrames';
import { handleStorageRequest } from './handleRequest';

const config = {
  navigation: [
    {
      label: 'Companion',
      path: 'companion',
      url: 'http://localhost:5175/',
      safeForAuthToken: true,
    },
    {
      label: 'Hostile',
      path: 'hostile',
      url: 'http://localhost:5199/',
      safeForAuthToken: false,
    },
  ],
} as ShellUIConfig;

describe('StorageBridge trust gate', () => {
  it('rejects hostile iframe storage requests before storage I/O', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const denial = getStorageRequestTrustDenial(
      ['hostile-uuid'],
      {
        getAllIframes: () => [
          ['hostile-uuid', { src: 'http://localhost:5199/widget' } as HTMLIFrameElement],
        ],
      },
      config,
    );

    expect(denial).toEqual({
      message: 'Storage request rejected: untrusted frame',
      status: 403,
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('allows trusted companion frames to reach handleStorageRequest', async () => {
    const denial = getStorageRequestTrustDenial(
      ['companion-uuid'],
      {
        getAllIframes: () => [
          ['companion-uuid', { src: 'http://localhost:5175/company' } as HTMLIFrameElement],
        ],
      },
      config,
    );
    expect(denial).toBeNull();

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
        payload: { id: 'req-trusted', op: 'listBuckets' },
      }),
    ).resolves.toEqual({
      id: 'req-trusted',
      data: [{ name: 'company' }],
    });

    vi.unstubAllGlobals();
  });
});
