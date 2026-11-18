// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../i18n/translations/en/settings.json';
import fr from '../../../i18n/translations/fr/settings.json';
import {
  MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS,
  agentPromptContainsCredentialMaterial,
  buildAgentPrompt,
} from '../../mcp/mcpAgentsConnect';
import type { McpAgentSummary } from '../../mcp/personalAgentsApi';
import { McpAgents } from './McpAgents';

const page = vi.hoisted(() => ({
  language: 'en',
  aiUrl: 'https://ai.example/' as string | null,
  visibility: 'visible',
}));

const api = vi.hoisted(() => ({
  fetchMcpPersonalAgents: vi.fn(),
  createMcpPersonalAgent: vi.fn(),
  revokeMcpPersonalAgent: vi.fn(),
}));

const dialogMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const writeText = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/personalAgentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mcp/personalAgentsApi')>();
  return {
    ...actual,
    fetchMcpPersonalAgents: api.fetchMcpPersonalAgents,
    createMcpPersonalAgent: api.createMcpPersonalAgent,
    revokeMcpPersonalAgent: api.revokeMcpPersonalAgent,
  };
});

vi.mock('../../config/useConfig', () => ({
  useConfig: () => ({
    config: {
      title: 'Acme',
      backend: { type: 'shellui', url: 'https://id.example', companyId: '42' },
      ...(page.aiUrl ? { aiService: { url: page.aiUrl } } : {}),
    },
  }),
}));

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    session: { accessToken: 'session-token' },
    user: { id: 'user-1' },
  }),
}));

vi.mock('../hooks/useMcpPersonalStatus', () => ({
  useMcpPersonalStatus: () => ({
    status: {
      mcpEnabled: true,
      mcpUrl: null,
      globalMcpUrl: 'https://saas.example/mcp',
      globalIdentity: false,
    },
    loading: false,
    error: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('../hooks/useMcpPendingToolApprovals', () => ({
  useMcpPendingToolApprovals: () => ({
    approvals: [],
    pendingCount: 0,
    refresh: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string | number>) => {
      const catalog = page.language.startsWith('fr') ? fr : en;
      const parts = key.replace('mcpAgents.', '').split('.');
      let raw: unknown = catalog.mcpAgents;
      for (const part of parts) {
        if (raw && typeof raw === 'object' && part in raw) {
          raw = (raw as Record<string, unknown>)[part];
        } else {
          raw = key;
          break;
        }
      }
      const text = typeof raw === 'string' ? raw : key;
      return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(opts?.[name] ?? ''));
    },
    i18n: {
      get language() {
        return page.language;
      },
    },
  }),
}));

vi.mock('@shellui/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shellui/sdk')>();
  return {
    ...actual,
    shellui: {
      ...actual.shellui,
      dialog: (...args: unknown[]) => dialogMock(...args),
      toast: (...args: unknown[]) => toastMock(...args),
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MCP_URL = 'https://ai.example/c/42/mcp';

function connection(overrides: Partial<McpAgentSummary> = {}): McpAgentSummary {
  return {
    id: 'oauth-1',
    kind: 'oauth',
    name: 'Cursor on my laptop',
    accessMode: 'ask',
    readLevel: 'safe',
    allowDestructiveWithoutAsking: false,
    servicesAllowed: ['identity', 'storage'],
    expiresAt: '2026-12-01T00:00:00.000Z',
    pausedAt: null,
    revokedAt: null,
    isActive: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    oauthClientId: 'client-1',
    personalTokenId: null,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  page.language = 'en';
  page.aiUrl = 'https://ai.example/';
  page.visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => page.visibility,
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  dialogMock.mockReset();
  toastMock.mockReset();
  api.fetchMcpPersonalAgents.mockReset();
  api.createMcpPersonalAgent.mockReset();
  api.revokeMcpPersonalAgent.mockReset();
  api.fetchMcpPersonalAgents.mockResolvedValue([]);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderPage() {
  await act(async () => {
    root.render(<McpAgents />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buttonByText(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent === label);
}

describe('McpAgents connect prompt', () => {
  it('shows the company MCP URL, the OAuth prompt, and the three steps', async () => {
    await renderPage();

    expect(container.textContent).toContain('Connect an agent');
    expect(container.textContent).toContain(MCP_URL);
    expect(container.textContent).toContain('Paste the prompt into your agent.');
    expect(container.textContent).toContain('Open the link it shows.');
    expect(container.textContent).toContain('Check the code and choose Allow.');

    const prompt = container.querySelector('pre')?.textContent ?? '';
    expect(prompt).toBe(buildAgentPrompt(MCP_URL, 'en'));
    expect(prompt).not.toContain('session-token');
    expect(agentPromptContainsCredentialMaterial(prompt.replace(MCP_URL, ''))).toBe(false);

    const details = container.querySelector('details');
    expect(details).toBeTruthy();
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain('Clients that only accept a static secret');
  });

  it('copies the prompt and the URL without a secret', async () => {
    await renderPage();

    await act(async () => {
      buttonByText('Copy prompt')?.click();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(buildAgentPrompt(MCP_URL, 'en'));

    await act(async () => {
      buttonByText('Copy URL')?.click();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(MCP_URL);
  });

  it('shows the French prompt and steps', async () => {
    page.language = 'fr';
    await renderPage();

    const prompt = container.querySelector('pre')?.textContent ?? '';
    expect(prompt).toBe(buildAgentPrompt(MCP_URL, 'fr'));
    expect(container.textContent).toContain("Collez l'invite dans votre agent.");
    expect(container.textContent).toContain("Ouvrez le lien qu'il affiche.");
    expect(container.textContent).toContain('Vérifiez le code, puis choisissez Autoriser.');
    expect(agentPromptContainsCredentialMaterial(prompt.replace(MCP_URL, ''))).toBe(false);
  });

  it('explains when the MCP URL is missing', async () => {
    page.aiUrl = null;
    await renderPage();

    expect(container.textContent).toContain('MCP URL is not configured.');
    expect(container.querySelector('pre')).toBeNull();
    expect(buttonByText('Copy prompt')).toBeUndefined();
  });
});

describe('McpAgents static secret', () => {
  it('keeps the secret out of the prompt and inside the 90-day cap', async () => {
    api.createMcpPersonalAgent.mockResolvedValue({
      agent: connection({
        id: 'personal-1',
        kind: 'personal',
        name: 'Laptop agent',
        oauthClientId: null,
        personalTokenId: 'pt-1',
        servicesAllowed: ['identity', 'storage', 'hosting', 'email'],
      }),
      accessToken: 'static-secret-value',
      tokenType: 'Bearer',
      expiresAt: '2027-02-01T00:00:00.000Z',
      resource: MCP_URL,
    });
    api.fetchMcpPersonalAgents.mockResolvedValue([]);

    await renderPage();
    expect(container.textContent).not.toContain('static-secret-value');

    await act(async () => {
      buttonByText('Create secret')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const input = api.createMcpPersonalAgent.mock.calls[0]?.[3] as { expiresAt?: string };
    const lifetimeMs = Date.parse(input.expiresAt ?? '') - Date.now();
    expect(lifetimeMs).toBeLessThan(MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS * 86_400_000);
    expect(lifetimeMs).toBeGreaterThan(89 * 86_400_000);

    expect(container.textContent).toContain('static-secret-value');
    expect(container.textContent).toContain('Shellui shows it only once.');
    const prompt = container.querySelector('pre')?.textContent ?? '';
    expect(prompt).toBe(buildAgentPrompt(MCP_URL, 'en'));
    expect(prompt).not.toContain('static-secret-value');
    expect(container.querySelector('details')?.open).toBe(true);

    await act(async () => {
      buttonByText('Hide secret')?.click();
    });
    expect(container.textContent).not.toContain('static-secret-value');
  });
});

describe('McpAgents connections', () => {
  it('renders an OAuth connection and reloads when the tab is visible again', async () => {
    const oauth = connection();
    api.fetchMcpPersonalAgents.mockResolvedValueOnce([]).mockResolvedValue([oauth]);

    await renderPage();
    expect(container.textContent).toContain('No active connections.');

    page.visibility = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Cursor on my laptop');
    expect(container.textContent).toContain('Signed in with OAuth');
    expect(container.textContent).toContain('Expires');
    expect(container.textContent).toContain('Services: identity, storage');
    expect(buttonByText('Revoke')).toBeTruthy();
    expect(container.textContent).not.toContain('All regional services');

    const personal = connection({
      id: 'personal-2',
      kind: 'personal',
      name: 'Static laptop',
      oauthClientId: null,
      personalTokenId: 'pt-2',
      servicesAllowed: ['identity'],
    });
    api.fetchMcpPersonalAgents.mockResolvedValue([personal]);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Static laptop');
    expect(container.textContent).toContain('Static secret');
    expect(container.textContent).toContain('All regional services');
    expect(buttonByText('Revoke')).toBeTruthy();
  });
});
