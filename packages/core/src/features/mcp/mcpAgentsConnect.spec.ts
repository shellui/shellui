import { describe, expect, it } from 'vitest';
import en from '../../i18n/translations/en/settings.json';
import fr from '../../i18n/translations/fr/settings.json';
import {
  AGENT_CONNECT_STEPS,
  MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS,
  agentIncludesSaasScope,
  agentPromptContainsCredentialMaterial,
  buildAgentPrompt,
  buildCompanyMcpUrl,
  buildGlobalMcpUrl,
  resolveSettingsMcpUrl,
  defaultPersonalAgentExpiresAt,
  formatDefaultAgentName,
  getDefaultPersonalAgentServices,
  isAbsoluteHttpUrl,
  isActiveMcpConnection,
  isGlobalIdentitySession,
  resolveAgentConnectPromptLocale,
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

describe('buildGlobalMcpUrl', () => {
  it('uses a configured /mcp URL and ignores a trailing slash on the ai host', () => {
    expect(buildGlobalMcpUrl('https://ai.example/', 'https://global.example/mcp')).toBe(
      'https://global.example/mcp',
    );
    expect(buildGlobalMcpUrl('https://ai.example/')).toBe('https://ai.example/mcp');
  });

  it('ignores a configured URL that is not an absolute /mcp endpoint', () => {
    expect(buildGlobalMcpUrl('https://ai.example', 'https://global.example/c/1/mcp')).toBe(
      'https://ai.example/mcp',
    );
    expect(buildGlobalMcpUrl(null, 'not-a-url')).toBe(null);
  });
});

describe('resolveSettingsMcpUrl', () => {
  it('uses the configured global MCP URL even when a company id is set', () => {
    expect(
      resolveSettingsMcpUrl({
        aiServiceUrl: 'https://ai.example',
        companyId: '1',
        configuredGlobalMcpUrl: 'https://global.example/mcp',
        statusMcpUrl: 'https://ai.example/c/1/mcp',
      }),
    ).toBe('https://global.example/mcp');
  });

  it('uses the regional company URL when no global MCP URL is configured', () => {
    expect(
      resolveSettingsMcpUrl({
        aiServiceUrl: 'https://ai.example/',
        companyId: '42',
        statusMcpUrl: 'https://unused.example/c/42/mcp',
      }),
    ).toBe('https://ai.example/c/42/mcp');
  });

  it('falls back to {ai}/mcp when there is no company id', () => {
    expect(
      resolveSettingsMcpUrl({
        aiServiceUrl: 'https://ai.example/',
        companyId: '',
        statusGlobalMcpUrl: 'https://status.example/mcp',
      }),
    ).toBe('https://ai.example/mcp');
  });

  it('falls back to status global MCP URL when a configured URL is invalid', () => {
    expect(
      resolveSettingsMcpUrl({
        aiServiceUrl: null,
        companyId: '1',
        configuredGlobalMcpUrl: 'https://ai.example/c/1/mcp',
        statusGlobalMcpUrl: 'https://status.example/mcp',
      }),
    ).toBe('https://status.example/mcp');
  });
});

describe('isGlobalIdentitySession', () => {
  it('reads globalIdentity from status when present', () => {
    expect(
      isGlobalIdentitySession({
        mcpEnabled: true,
        mcpUrl: null,
        globalMcpUrl: null,
        globalIdentity: false,
      }),
    ).toBe(false);
  });

  it('is false when globalIdentity is omitted or false', () => {
    expect(isGlobalIdentitySession({ mcpEnabled: true, mcpUrl: null, globalMcpUrl: null })).toBe(
      false,
    );
    expect(isGlobalIdentitySession(null)).toBe(false);
    expect(
      isGlobalIdentitySession({
        mcpEnabled: true,
        mcpUrl: null,
        globalMcpUrl: null,
        globalIdentity: true,
      }),
    ).toBe(true);
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

describe('isAbsoluteHttpUrl', () => {
  it('accepts http and https and rejects relative paths', () => {
    expect(isAbsoluteHttpUrl('https://ai.test/c/1/mcp')).toBe(true);
    expect(isAbsoluteHttpUrl('http://localhost:8006/c/1/mcp')).toBe(true);
    expect(isAbsoluteHttpUrl('/c/1/mcp')).toBe(false);
    expect(isAbsoluteHttpUrl('')).toBe(false);
  });
});

describe('resolveAgentConnectPromptLocale', () => {
  it('selects French only for fr language tags', () => {
    expect(resolveAgentConnectPromptLocale('fr')).toBe('fr');
    expect(resolveAgentConnectPromptLocale('fr-CA')).toBe('fr');
    expect(resolveAgentConnectPromptLocale('en-US')).toBe('en');
    expect(resolveAgentConnectPromptLocale(null)).toBe('en');
  });
});

describe('buildAgentPrompt', () => {
  const mcpUrl = 'https://ai.test/c/1/mcp';
  const english = [
    'Connect to this Shellui company over MCP.',
    '',
    `MCP URL: ${mcpUrl}`,
    '',
    'Add this URL as a remote MCP server and sign in with OAuth.',
    'If this client is headless or a CLI, use device login.',
    'Show the link and the code, then wait until I approve them.',
  ].join('\n');
  const french = [
    'Connectez cette entreprise Shellui en MCP.',
    '',
    `URL MCP : ${mcpUrl}`,
    '',
    'Ajoutez cette URL comme serveur MCP distant et connectez-vous avec OAuth.',
    'Si le client est sans interface ou en ligne de commande, utilisez device login.',
    'Montrez le lien et le code, puis attendez que je les approuve.',
  ].join('\n');

  it('uses the English OAuth prompt and the company MCP URL', () => {
    expect(buildAgentPrompt(mcpUrl)).toBe(english);
    expect(buildAgentPrompt(mcpUrl, 'en')).toBe(english);
    expect(buildAgentPrompt(`  ${mcpUrl}  `, 'en')).toBe(english);
  });

  it('uses the French OAuth prompt for fr', () => {
    expect(buildAgentPrompt(mcpUrl, 'fr')).toBe(french);
  });

  it('does not interpolate a token passed in place of the locale', () => {
    const leaked = 'shh-static-secret-value';
    const prompt = buildAgentPrompt(mcpUrl, leaked as 'en');
    expect(prompt).toBe(english);
    expect(prompt).not.toContain(leaked);
    expect(agentPromptContainsCredentialMaterial(prompt.replace(mcpUrl, ''))).toBe(false);
    expect(agentPromptContainsCredentialMaterial(french.replace(mcpUrl, ''))).toBe(false);
  });

  it('rejects a URL that is not absolute http(s)', () => {
    expect(() => buildAgentPrompt('/c/1/mcp')).toThrow(/absolute http/);
  });

  it('matches the settings steps the page renders', () => {
    expect(Object.values(en.mcpAgents.connect.steps)).toEqual([...AGENT_CONNECT_STEPS.en]);
    expect(Object.values(fr.mcpAgents.connect.steps)).toEqual([...AGENT_CONNECT_STEPS.fr]);
  });
});

function translationKeyPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    translationKeyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('mcpAgents translations', () => {
  it('keeps English and French keys aligned', () => {
    expect(translationKeyPaths(en.mcpAgents).sort()).toEqual(
      translationKeyPaths(fr.mcpAgents).sort(),
    );
  });
});

describe('defaultPersonalAgentExpiresAt', () => {
  it('stays inside Identity default maximum of 90 days', () => {
    const fromMs = Date.parse('2026-11-09T17:05:00.000Z');
    const expiresMs = Date.parse(defaultPersonalAgentExpiresAt(fromMs));
    const maxMs = fromMs + MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS * 86_400_000;
    expect(expiresMs).toBeLessThan(maxMs);
    expect(maxMs - expiresMs).toBe(60_000);
    expect(expiresMs - fromMs).toBeLessThan(365 * 86_400_000);
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
