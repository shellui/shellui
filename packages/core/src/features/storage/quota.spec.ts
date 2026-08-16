import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShellUIConfig } from '../config/types';
import {
  fetchStorageQuota,
  formatBytes,
  getStorageBaseUrl,
  getUsagePercent,
  isStorageSettingsEnabled,
  parseStorageQuota,
} from './quota';

describe('getStorageBaseUrl', () => {
  it('returns a trimmed url without a trailing slash', () => {
    expect(getStorageBaseUrl({ storage: { url: ' http://localhost:8001/ ' } })).toBe(
      'http://localhost:8001',
    );
  });

  it('returns null when storage is missing or empty', () => {
    expect(getStorageBaseUrl(undefined)).toBeNull();
    expect(getStorageBaseUrl({} as ShellUIConfig)).toBeNull();
    expect(getStorageBaseUrl({ storage: { url: '   ' } })).toBeNull();
  });
});

describe('isStorageSettingsEnabled', () => {
  it('is true when storage.url is set', () => {
    expect(isStorageSettingsEnabled({ storage: { url: 'http://localhost:8001' } })).toBe(true);
  });

  it('is false when storage is not configured', () => {
    expect(isStorageSettingsEnabled(undefined)).toBe(false);
    expect(isStorageSettingsEnabled({} as ShellUIConfig)).toBe(false);
  });

  it('is false when showInSettings is false', () => {
    expect(
      isStorageSettingsEnabled({
        storage: { url: 'http://localhost:8001', showInSettings: false },
      }),
    ).toBe(false);
  });

  it('is true when showInSettings is true', () => {
    expect(
      isStorageSettingsEnabled({
        storage: { url: 'http://localhost:8001', showInSettings: true },
      }),
    ).toBe(true);
  });
});

describe('formatBytes', () => {
  it('formats zero and invalid values as 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });

  it('formats bytes, kilobytes, and gigabytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10 * 1024)).toBe('10 KB');
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
  });
});

describe('getUsagePercent', () => {
  it('returns null when there is no positive max', () => {
    expect(getUsagePercent(100, null)).toBeNull();
    expect(getUsagePercent(100, 0)).toBeNull();
  });

  it('clamps used bytes between 0 and 100', () => {
    expect(getUsagePercent(0, 100)).toBe(0);
    expect(getUsagePercent(25, 100)).toBe(25);
    expect(getUsagePercent(200, 100)).toBe(100);
  });
});

describe('parseStorageQuota', () => {
  const validPayload = {
    company_id: 1,
    company: { max_bytes: 1000, used_bytes: 250, remaining_bytes: 750 },
    user: { user_id: 42, max_bytes: null, used_bytes: 80, remaining_bytes: null },
  };

  it('parses a valid quota payload', () => {
    expect(parseStorageQuota(validPayload)).toEqual({
      companyId: 1,
      company: { maxBytes: 1000, usedBytes: 250, remainingBytes: 750 },
      user: { userId: 42, maxBytes: null, usedBytes: 80, remainingBytes: null },
    });
  });

  it('treats a zero max as no limit', () => {
    expect(
      parseStorageQuota({
        ...validPayload,
        user: { user_id: 42, max_bytes: 0, used_bytes: 80, remaining_bytes: null },
      })?.user.maxBytes,
    ).toBeNull();
  });

  it('returns null for incomplete payloads', () => {
    expect(parseStorageQuota(null)).toBeNull();
    expect(parseStorageQuota({})).toBeNull();
    expect(parseStorageQuota({ ...validPayload, user: { used_bytes: 1 } })).toBeNull();
  });
});

describe('fetchStorageQuota', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the quota endpoint with a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        company_id: 1,
        company: { max_bytes: 100, used_bytes: 10, remaining_bytes: 90 },
        user: { user_id: 2, max_bytes: 50, used_bytes: 5, remaining_bytes: 45 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchStorageQuota('http://localhost:8001/', 'token-1')).resolves.toMatchObject({
      companyId: 1,
      user: { userId: 2, usedBytes: 5 },
    });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8001/storage/v1/quota', {
      headers: {
        Authorization: 'Bearer token-1',
        Accept: 'application/json',
      },
    });
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );

    await expect(fetchStorageQuota('http://localhost:8001', 'token-1')).rejects.toThrow('HTTP 401');
  });
});
