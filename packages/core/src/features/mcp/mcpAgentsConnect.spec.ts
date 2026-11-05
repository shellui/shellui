import { describe, expect, it } from 'vitest';
import {
  agentIncludesSaasScope,
  buildAgentPrompt,
  buildCompanyMcpUrl,
  formatDefaultAgentName,
  getDefaultPersonalAgentServices,
  isActiveMcpConnection,
  isGlobalIdentitySession,
} from './mcpAgentsConnect';
import type { McpAgentSummary } from './personalAgentsApi';

describe('buildCompanyMcpUrl', () => {
  it('builds /c/{company}/mcp on the ai host', () => {
    expect(buildCompanyMcpUrl('http://localhost:8006/', '42')).toBe(
      'http://localhost:8006/c/42/mcp',
    );
  });

  it('falls back to identity status url when ai url is missing', () => {
    expect(buildCompanyMcpUrl(null, '1', 'https://ai.test/c/1/mcp')).toBe(
      'https://ai.test/c/1/mcp',
    );
  });
});

describe('isGlobalIdentitySession', () => {
  it('reads globalIdentity from status when present', () => {
    expect(isGlobalIdentitySession({ mcpEnabled: true, mcpUrl: null, globalIdentity: false })).toBe(
      false,
    );
  });

  it('is false when globalIdentity is omitted or false', () => {
    expect(isGlobalIdentitySession({ mcpEnabled: true, mcpUrl: null })).toBe(false);
    expect(isGlobalIdentitySession(null)).toBe(false);
    expect(isGlobalIdentitySession({ mcpEnabled: true, mcpUrl: null, globalIdentity: true })).toBe(
      true,
    );
  });
});

describe('getDefaultPersonalAgentServices', () => {
  it('includes every regional service and optional saas', () => {
    expect(getDefaultPersonalAgentServices(false)).toEqual([
      'identity',
      'storage',
      'hosting',
      'email',
    ]);
    expect(getDefaultPersonalAgentServices(true)).toContain('saas');
  });
});

describe('buildAgentPrompt', () => {
  it('embeds url and token in the approved template', () => {
    const prompt = buildAgentPrompt('https://ai.test/c/1/mcp', 'secret-token');
    expect(prompt).toContain('MCP URL: https://ai.test/c/1/mcp');
    expect(prompt).toContain('Access token: secret-token');
    expect(prompt).toContain('Connect to this Shellui company over MCP.');
  });
});

describe('formatDefaultAgentName', () => {
  it('uses Agent · short date', () => {
    expect(formatDefaultAgentName('en-US', new Date('2026-11-05T12:00:00Z'))).toMatch(
      /^Agent · Nov/,
    );
  });
});

describe('isActiveMcpConnection', () => {
  const base: McpAgentSummary = {
    id: 'a1',
    kind: 'personal',
    name: 'Test',
    accessMode: 'ask',
    readLevel: 'safe',
    allowDestructiveWithoutAsking: false,
    servicesAllowed: ['identity'],
    expiresAt: '2099-01-01T00:00:00Z',
    pausedAt: null,
    revokedAt: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    oauthClientId: null,
    personalTokenId: 'p1',
  };

  it('is false when revoked or expired', () => {
    expect(isActiveMcpConnection(base)).toBe(true);
    expect(isActiveMcpConnection({ ...base, revokedAt: '2026-02-01T00:00:00Z' })).toBe(false);
    expect(
      isActiveMcpConnection({ ...base, expiresAt: '2020-01-01T00:00:00Z' }, 1_700_000_000_000),
    ).toBe(false);
  });
});

describe('agentIncludesSaasScope', () => {
  it('detects saas in services_allowed', () => {
    expect(
      agentIncludesSaasScope({ servicesAllowed: ['identity', 'saas'] } as McpAgentSummary),
    ).toBe(true);
    expect(agentIncludesSaasScope({ servicesAllowed: ['identity'] } as McpAgentSummary)).toBe(
      false,
    );
  });
});
