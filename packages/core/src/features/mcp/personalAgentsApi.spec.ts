import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShellUIConfig } from '../config/types';
import {
  createMcpPersonalAgent,
  fetchMcpPersonalAgents,
  fetchMcpPersonalStatus,
  getMcpPersonalCompanyId,
  getShellIdentityBackendUrl,
  parseCreatePersonalAgentResult,
  parseMcpAgentList,
  parseMcpAgentSummary,
  parseMcpPersonalStatus,
  revokeMcpPersonalAgent,
} from './personalAgentsApi';

describe('getShellIdentityBackendUrl', () => {
  it('returns a trimmed shellui backend url', () => {
    expect(
      getShellIdentityBackendUrl({
        backend: { type: 'shellui', url: ' https://id.example.com/ ' },
      } as ShellUIConfig),
    ).toBe('https://id.example.com');
  });

  it('returns null for non-shellui backends', () => {
    expect(
      getShellIdentityBackendUrl({ backend: { type: 'other', url: 'x' } } as ShellUIConfig),
    ).toBe(null);
  });
});

describe('getMcpPersonalCompanyId', () => {
  it('uses numeric company id from config', () => {
    expect(
      getMcpPersonalCompanyId({
        backend: { type: 'shellui', url: 'x', companyId: 42 },
      } as ShellUIConfig),
    ).toBe('42');
  });
});

describe('parseMcpPersonalStatus', () => {
  it('parses enabled status and url', () => {
    expect(
      parseMcpPersonalStatus({ mcp_enabled: true, mcp_url: 'https://ai.test/c/1/mcp' }),
    ).toEqual({ mcpEnabled: true, mcpUrl: 'https://ai.test/c/1/mcp' });
  });

  it('parses global_identity when present', () => {
    expect(
      parseMcpPersonalStatus({
        mcp_enabled: true,
        mcp_url: null,
        global_identity: false,
      }),
    ).toEqual({ mcpEnabled: true, mcpUrl: null, globalIdentity: false });
  });

  it('returns null for invalid payloads', () => {
    expect(parseMcpPersonalStatus({ mcp_enabled: 'yes' })).toBeNull();
  });
});

describe('parseMcpAgentSummary', () => {
  const row = {
    id: 'a1',
    kind: 'personal',
    name: 'CLI',
    access_mode: 'ask',
    read_level: 'safe',
    allow_destructive_without_asking: false,
    services_allowed: ['identity', 'ai'],
    expires_at: '2026-12-01T00:00:00Z',
    paused_at: null,
    revoked_at: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    oauth_client_id: null,
    personal_token_id: 'pt-1',
  };

  it('maps snake_case fields', () => {
    expect(parseMcpAgentSummary(row)).toMatchObject({
      id: 'a1',
      kind: 'personal',
      accessMode: 'ask',
      readLevel: 'safe',
      servicesAllowed: ['identity', 'ai'],
      personalTokenId: 'pt-1',
    });
  });
});

describe('parseMcpAgentList', () => {
  it('filters invalid rows', () => {
    expect(parseMcpAgentList({ agents: [{ id: 'x' }, null] })).toEqual([]);
  });
});

describe('parseCreatePersonalAgentResult', () => {
  it('parses create response', () => {
    const agent = {
      id: 'a1',
      kind: 'personal',
      name: 'CLI',
      access_mode: 'read_only',
      read_level: 'safe',
      allow_destructive_without_asking: false,
      services_allowed: ['identity'],
      expires_at: null,
      paused_at: null,
      revoked_at: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      oauth_client_id: null,
      personal_token_id: 'p1',
    };
    expect(
      parseCreatePersonalAgentResult({
        agent,
        access_token: 'secret',
        token_type: 'bearer',
        expires_at: '2026-02-01T00:00:00Z',
        resource: 'https://ai.test/c/1/mcp',
      }),
    ).toMatchObject({
      accessToken: 'secret',
      tokenType: 'bearer',
      resource: 'https://ai.test/c/1/mcp',
    });
  });
});

describe('mcp personal fetch helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchMcpPersonalStatus sends bearer and company_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mcp_enabled: true, mcp_url: 'https://ai.test/c/1/mcp' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const status = await fetchMcpPersonalStatus('https://id.example.com', 'tok', '7');
    expect(status.mcpEnabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://id.example.com/api/v1/mcp/personal/status?company_id=7');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('createMcpPersonalAgent posts snake_case body', async () => {
    const agent = {
      id: 'a1',
      kind: 'personal',
      name: 'CLI',
      access_mode: 'ask',
      read_level: 'safe',
      allow_destructive_without_asking: false,
      services_allowed: ['identity'],
      expires_at: '2026-12-01T00:00:00Z',
      paused_at: null,
      revoked_at: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      oauth_client_id: null,
      personal_token_id: 'p1',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        agent,
        access_token: 'once',
        token_type: 'bearer',
        expires_at: '2026-12-01T00:00:00Z',
        resource: 'https://ai.test/c/1/mcp',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await createMcpPersonalAgent('https://id.example.com', 'tok', '1', {
      name: 'CLI',
      services: ['identity'],
      accessMode: 'ask',
      readLevel: 'safe',
      allowDestructive: false,
      expiresAt: '2026-12-01T00:00:00Z',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'CLI',
      services: ['identity'],
      access_mode: 'ask',
      read_level: 'safe',
      allow_destructive: false,
      expires_at: '2026-12-01T00:00:00Z',
    });
  });

  it('fetchMcpPersonalAgents parses list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agents: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMcpPersonalAgents('https://id.example.com', 'tok', '')).resolves.toEqual([]);
  });

  it('revokeMcpPersonalAgent posts to revoke path', async () => {
    const agent = {
      id: 'a1',
      kind: 'personal',
      name: 'CLI',
      access_mode: 'ask',
      read_level: 'safe',
      allow_destructive_without_asking: false,
      services_allowed: ['identity'],
      expires_at: null,
      paused_at: null,
      revoked_at: '2026-02-01T00:00:00Z',
      is_active: false,
      created_at: '2026-01-01T00:00:00Z',
      oauth_client_id: null,
      personal_token_id: 'p1',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agent }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const revoked = await revokeMcpPersonalAgent('https://id.example.com', 'tok', '1', 'a1');
    expect(revoked.revokedAt).toBeTruthy();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v1/mcp/personal/agents/a1/revoke');
  });
});
