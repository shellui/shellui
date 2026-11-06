import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearMcpPersonalStatusCache,
  MCP_PERSONAL_STATUS_CACHE_KEY,
  readMcpPersonalStatusCache,
  writeMcpPersonalStatusCache,
} from './mcpPersonalStatusCache';

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

describe('mcpPersonalStatusCache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores only MCP flags scoped to user and identity URL', () => {
    vi.stubGlobal('sessionStorage', memoryStorage());
    const scope = {
      userId: 'user-1',
      backendUrl: 'https://id.example.com',
      companyId: '7',
    };
    writeMcpPersonalStatusCache(scope, {
      mcpEnabled: true,
      mcpUrl: 'https://ai.test/mcp',
      globalMcpUrl: null,
    });

    expect(readMcpPersonalStatusCache(scope)).toEqual({
      mcpEnabled: true,
      mcpUrl: 'https://ai.test/mcp',
      globalMcpUrl: null,
    });

    writeMcpPersonalStatusCache(scope, {
      mcpEnabled: true,
      mcpUrl: 'https://ai.test/mcp',
      globalMcpUrl: 'https://dash.example.com/mcp',
    });
    expect(readMcpPersonalStatusCache(scope)).toEqual({
      mcpEnabled: true,
      mcpUrl: 'https://ai.test/mcp',
      globalMcpUrl: 'https://dash.example.com/mcp',
    });
    expect(readMcpPersonalStatusCache({ ...scope, userId: 'user-2' })).toBeNull();

    const raw = sessionStorage.getItem(MCP_PERSONAL_STATUS_CACHE_KEY) ?? '';
    expect(raw).not.toMatch(/access/i);
    expect(raw).not.toMatch(/token/i);
  });

  it('clears cached status', () => {
    vi.stubGlobal('sessionStorage', memoryStorage());
    writeMcpPersonalStatusCache(
      { userId: 'u', backendUrl: 'https://id.example.com', companyId: '1' },
      { mcpEnabled: false, mcpUrl: null, globalMcpUrl: null },
    );
    clearMcpPersonalStatusCache();
    expect(sessionStorage.getItem(MCP_PERSONAL_STATUS_CACHE_KEY)).toBeNull();
  });
});
