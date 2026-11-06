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
  parseMcpAgentActivity,
  parseMcpAgentSummary,
  parseMcpPersonalStatus,
  parseStrictMcpActivityErrorCode,
  parseStrictMcpActivityOutcome,
  parseValidatedGlobalMcpEndpointUrl,
  revokeMcpPersonalAgent,
  MCP_ACTIVITY_ERROR_CODES,
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

describe('parseValidatedGlobalMcpEndpointUrl', () => {
  it('accepts https origin + /mcp only', () => {
    expect(parseValidatedGlobalMcpEndpointUrl('https://dash.example.com/mcp')).toBe(
      'https://dash.example.com/mcp',
    );
    expect(parseValidatedGlobalMcpEndpointUrl('https://dash.example.com/mcp/')).toBe(
      'https://dash.example.com/mcp',
    );
  });

  it('rejects bare origin, double path, queries, and non-http(s)', () => {
    expect(parseValidatedGlobalMcpEndpointUrl('https://dash.example.com')).toBeNull();
    expect(parseValidatedGlobalMcpEndpointUrl('https://dash.example.com/mcp/mcp')).toBeNull();
    expect(parseValidatedGlobalMcpEndpointUrl('https://dash.example.com/mcp?x=1')).toBeNull();
    expect(parseValidatedGlobalMcpEndpointUrl('ftp://dash.example.com/mcp')).toBeNull();
    expect(parseValidatedGlobalMcpEndpointUrl('https://user@dash.example.com/mcp')).toBeNull();
  });
});

describe('parseMcpPersonalStatus', () => {
  it('parses enabled status and url', () => {
    expect(
      parseMcpPersonalStatus({ mcp_enabled: true, mcp_url: 'https://ai.test/c/1/mcp' }),
    ).toEqual({ mcpEnabled: true, mcpUrl: 'https://ai.test/c/1/mcp', globalMcpUrl: null });
  });

  it('parses global_mcp_url when present', () => {
    expect(
      parseMcpPersonalStatus({
        mcp_enabled: true,
        mcp_url: null,
        global_mcp_url: 'https://dash.example.com/mcp',
      }),
    ).toEqual({ mcpEnabled: true, mcpUrl: null, globalMcpUrl: 'https://dash.example.com/mcp' });
  });

  it('drops invalid global_mcp_url', () => {
    expect(
      parseMcpPersonalStatus({
        mcp_enabled: true,
        mcp_url: null,
        global_mcp_url: 'https://dash.example.com',
      }),
    ).toEqual({ mcpEnabled: true, mcpUrl: null, globalMcpUrl: null });
  });

  it('parses global_identity when present', () => {
    expect(
      parseMcpPersonalStatus({
        mcp_enabled: true,
        mcp_url: null,
        global_identity: false,
      }),
    ).toEqual({ mcpEnabled: true, mcpUrl: null, globalMcpUrl: null, globalIdentity: false });
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

describe('parseStrictMcpActivityOutcome', () => {
  it('maps only exact normalized tokens', () => {
    expect(parseStrictMcpActivityOutcome('allowed')).toBe('allowed');
    expect(parseStrictMcpActivityOutcome('Denied')).toBe('denied');
    expect(parseStrictMcpActivityOutcome('not-a-known-outcome')).toBeNull();
  });
});

describe('parseStrictMcpActivityErrorCode', () => {
  it('accepts fixed allowlist only', () => {
    for (const code of MCP_ACTIVITY_ERROR_CODES) {
      expect(parseStrictMcpActivityErrorCode(code)).toBe(code);
      expect(parseStrictMcpActivityErrorCode(code.toUpperCase())).toBe(code);
    }
    expect(parseStrictMcpActivityErrorCode('custom_failure')).toBeNull();
  });

  it('drops injection-shaped keys that are not allowlisted tokens', () => {
    expect(parseStrictMcpActivityErrorCode("'; DROP TABLE activity; --")).toBeNull();
  });
});

describe('parseMcpAgentActivity', () => {
  it('maps optional enrichment fields', () => {
    const parsed = parseMcpAgentActivity({
      agent_id: 'a1',
      activity: [
        {
          timestamp: '2026-01-01T00:00:00Z',
          tool: 'x',
          service: 'identity',
          result: 'ok',
          outcome: 'allowed',
          access_kind: 'read',
          duration_ms: 42,
          resource_label: 'Members',
          operation_title: 'List members',
          company_name: 'Acme',
          actor: 'staff@example.com',
          agent_name: 'My bot',
          approval_request_id: 'ap-9',
          error_code: 'downstream_error',
          error_message:
            'Exception: https://evil.example/nonce token=secret-key https://x.test?token=1',
        },
      ],
    });
    expect(parsed?.activity[0]).toMatchObject({
      outcome: 'allowed',
      accessKind: 'read',
      durationMs: 42,
      resourceLabel: 'Members',
      operationTitle: 'List members',
      companyLabel: 'Acme',
      actorLabel: 'staff@example.com',
      agentName: 'My bot',
      approvalRequestId: 'ap-9',
      errorCode: 'downstream_error',
    });
  });

  it('ignores error_message and does not retain it on the row', () => {
    const parsed = parseMcpAgentActivity({
      agent_id: 'a1',
      activity: [
        {
          timestamp: '2026-01-01T00:00:00Z',
          tool: 'x',
          service: 'identity',
          result: 'failed',
          outcome: 'failed',
          error_code: 'internal_error',
          error_message: 'forbidden upstream text with https://evil.example',
        },
      ],
    });
    expect(parsed?.activity[0]).toMatchObject({ errorCode: 'internal_error' });
    expect(parsed?.activity[0]).not.toHaveProperty('errorDetailRaw');
  });

  it('treats negative duration_ms as not reported', () => {
    const parsed = parseMcpAgentActivity({
      agent_id: 'a1',
      activity: [
        {
          timestamp: '2026-01-01T00:00:00Z',
          tool: 'x',
          service: 'identity',
          result: 'ok',
          duration_ms: -5,
        },
      ],
    });
    expect(parsed?.activity[0]?.durationMs).toBeNull();
  });

  it('drops unrecognized outcome strings', () => {
    const parsed = parseMcpAgentActivity({
      agent_id: 'a1',
      activity: [
        {
          timestamp: '2026-01-01T12:00:00Z',
          tool: 'x',
          service: 'identity',
          result: 'custom_vendor_code',
          outcome: 'vendor_says_maybe',
        },
      ],
    });
    expect(parsed?.activity[0]?.outcome).toBeNull();
  });

  it('parses error_code and ignores invalid error_code', () => {
    const ok = parseMcpAgentActivity({
      agent_id: 'a1',
      activity: [
        {
          timestamp: '2026-01-01T12:00:00Z',
          tool: 'x',
          service: 'identity',
          result: 'failed',
          outcome: 'failed',
          error_code: 'identity_unreachable',
        },
      ],
    });
    expect(ok?.activity[0]).toMatchObject({
      errorCode: 'identity_unreachable',
      outcome: 'failed',
    });

    const bad = parseMcpAgentActivity({
      agent_id: 'a1',
      activity: [
        {
          timestamp: '2026-01-01T12:00:00Z',
          tool: 'x',
          service: 'identity',
          result: 'failed',
          outcome: 'failed',
          error_code: 'vendor_oops',
        },
      ],
    });
    expect(bad?.activity[0]).toMatchObject({ errorCode: null });
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
      json: async () => ({
        mcp_enabled: true,
        mcp_url: 'https://ai.test/c/1/mcp',
        global_mcp_url: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const status = await fetchMcpPersonalStatus('https://id.example.com', 'tok', '7');
    expect(status.mcpEnabled).toBe(true);
    expect(status.globalMcpUrl).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://id.example.com/api/v1/mcp/personal/status?company_id=7');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('createMcpPersonalAgent strips saas unless allowSaas is true', async () => {
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

    const input = {
      name: 'CLI',
      services: ['identity', 'saas'] as const,
      accessMode: 'ask' as const,
      readLevel: 'safe' as const,
      allowDestructive: false,
      expiresAt: '2026-12-01T00:00:00Z',
    };

    await createMcpPersonalAgent('https://id.example.com', 'tok', '1', {
      ...input,
      services: [...input.services],
    });
    let body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.services).toEqual(['identity']);

    fetchMock.mockClear();
    await createMcpPersonalAgent(
      'https://id.example.com',
      'tok',
      '1',
      {
        ...input,
        services: [...input.services],
      },
      { allowSaas: true },
    );
    body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.services).toEqual(['identity', 'saas']);
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
