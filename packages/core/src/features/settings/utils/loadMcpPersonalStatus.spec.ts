import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShellUIConfig } from '../../config/types';
import * as personalAgentsApi from '../../mcp/personalAgentsApi';
import { loadMcpPersonalStatus } from './loadMcpPersonalStatus';
import { readMcpPersonalStatusCache } from './mcpPersonalStatusCache';

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    key: (index: number) => [...map.keys()][index] ?? null,
  } satisfies Storage;
};

const shellConfig = {
  aiService: { url: 'https://ai.example.com' },
  backend: { type: 'shellui', url: 'https://id.example.com', companyId: 1 },
} as ShellUIConfig;

describe('loadMcpPersonalStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('dedupes in-flight requests and writes session cache on success', async () => {
    vi.stubGlobal('sessionStorage', memoryStorage());
    const fetchSpy = vi.spyOn(personalAgentsApi, 'fetchMcpPersonalStatus').mockResolvedValue({
      mcpEnabled: true,
      mcpUrl: 'https://ai.test/mcp',
      globalMcpUrl: null,
    });

    const input = {
      config: shellConfig,
      accessToken: 'access',
      isAuthenticated: true,
      userId: 'user-1',
    };

    const [a, b] = await Promise.all([loadMcpPersonalStatus(input), loadMcpPersonalStatus(input)]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ mcpEnabled: true, mcpUrl: 'https://ai.test/mcp', globalMcpUrl: null });
    expect(b).toEqual(a);
    expect(
      readMcpPersonalStatusCache({
        userId: 'user-1',
        backendUrl: 'https://id.example.com',
        companyId: '1',
      }),
    ).toEqual({ mcpEnabled: true, mcpUrl: 'https://ai.test/mcp', globalMcpUrl: null });
  });

  it('returns null without calling identity when prerequisites are missing', async () => {
    const fetchSpy = vi.spyOn(personalAgentsApi, 'fetchMcpPersonalStatus');
    const result = await loadMcpPersonalStatus({
      config: shellConfig,
      accessToken: null,
      isAuthenticated: true,
      userId: 'user-1',
    });
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
