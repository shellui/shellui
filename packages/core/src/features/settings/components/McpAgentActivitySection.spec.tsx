// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../i18n/translations/en/settings.json';
import type { McpAgentActivityRow, McpAgentSummary } from '../../mcp/personalAgentsApi';
import { McpAgentActivitySection } from './McpAgentActivitySection';

const api = vi.hoisted(() => ({
  fetchMcpPersonalAgentActivity: vi.fn(),
  fetchMcpPersonalAgentCallLogs: vi.fn(),
}));

vi.mock('../../mcp/personalAgentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mcp/personalAgentsApi')>();
  return {
    ...actual,
    fetchMcpPersonalAgentActivity: api.fetchMcpPersonalAgentActivity,
    fetchMcpPersonalAgentCallLogs: api.fetchMcpPersonalAgentCallLogs,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      const parts = key.replace('mcpAgents.', '').split('.');
      let raw: unknown = en.mcpAgents;
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
    i18n: { language: 'en' },
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const agent: McpAgentSummary = {
  id: 'agent-1',
  kind: 'oauth',
  name: 'Laptop',
  accessMode: 'ask',
  readLevel: 'safe',
  allowDestructiveWithoutAsking: false,
  servicesAllowed: ['storage'],
  expiresAt: null,
  pausedAt: null,
  revokedAt: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  oauthClientId: 'client-1',
  personalTokenId: null,
};

const activity = (overrides: Partial<McpAgentActivityRow>): McpAgentActivityRow => ({
  timestamp: '2026-06-01T00:00:00Z',
  tool: 'storage_list_bucket',
  service: 'storage',
  result: 'ok',
  clientIp: '203.0.113.4',
  companyId: '1',
  companyLabel: 'Acme',
  resourceLabel: null,
  operationTitle: 'List bucket',
  actorLabel: null,
  agentName: null,
  accessKind: 'read',
  durationMs: 12,
  outcome: 'allowed',
  approvalRequestId: null,
  errorCode: null,
  ...overrides,
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  api.fetchMcpPersonalAgentActivity.mockReset();
  api.fetchMcpPersonalAgentCallLogs.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function openActivity() {
  await act(async () => {
    root.render(
      <McpAgentActivitySection
        backendUrl="https://id.example"
        aiServiceUrl="https://ai.example"
        accessToken="tok"
        companyId="1"
        enabled
        agent={agent}
        pendingApprovals={[]}
        onJumpToApprovals={() => {}}
      />,
    );
  });
  const show = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === 'Show activity',
  );
  expect(show).toBeTruthy();
  await act(async () => {
    show?.click();
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('McpAgentActivitySection', () => {
  it('merges consent with call logs and shows wrapper, error, and approval', async () => {
    api.fetchMcpPersonalAgentActivity.mockResolvedValue([
      activity({
        timestamp: '2026-06-02T00:00:00Z',
        tool: 'identity_list_users',
        operationTitle: 'List members',
        service: 'identity',
      }),
      activity({
        timestamp: '2026-06-03T00:00:00Z',
        tool: 'oauth.authorize.approved',
        operationTitle: 'oauth.authorize.approved',
        service: 'identity',
        companyLabel: null,
      }),
    ]);
    api.fetchMcpPersonalAgentCallLogs.mockResolvedValue({
      count: 1,
      limit: 50,
      offset: 0,
      callLogs: [
        activity({
          timestamp: '2026-06-04T00:00:00Z',
          tool: 'storage_get',
          operationTitle: 'Read object',
          result: 'failed',
          outcome: 'failed',
          errorCode: 'downstream_error',
          errorMessage: 'Upstream timed out',
          wrapperTool: 'ai_call_tool',
          approvalOutcome: 'accepted',
          companyLabel: null,
          clientIp: null,
          actorLabel: 'dev@example.com',
        }),
      ],
    });

    await openActivity();

    expect(container.textContent).toContain('Read object');
    expect(container.textContent).toContain('OAuth consent approved');
    expect(container.textContent).not.toContain('List members');
    expect(container.textContent).toContain('via ai_call_tool');
    expect(container.textContent).toContain('Upstream timed out');
    expect(container.textContent).toContain('Accepted');
    expect(container.textContent).toContain('dev@example.com');
    expect(container.textContent).not.toContain('Acme');
    expect(api.fetchMcpPersonalAgentCallLogs).toHaveBeenCalledWith(
      'https://ai.example',
      'tok',
      'agent-1',
      { limit: 50, offset: 0 },
    );
  });

  it('keeps consent rows when ai-service is unreachable', async () => {
    api.fetchMcpPersonalAgentActivity.mockResolvedValue([
      activity({
        tool: 'oauth.device.approved',
        operationTitle: 'oauth.device.approved',
        service: 'identity',
      }),
    ]);
    api.fetchMcpPersonalAgentCallLogs.mockRejectedValue(new Error('network down'));

    await openActivity();

    expect(container.textContent).toContain('Device login approved');
    expect(container.textContent).toContain('Tool calls could not be loaded.');
    expect(container.textContent).not.toContain('Unable to load activity.');
  });

  it('loads the next call-log page with offset', async () => {
    api.fetchMcpPersonalAgentActivity.mockResolvedValue([]);
    api.fetchMcpPersonalAgentCallLogs
      .mockResolvedValueOnce({
        count: 60,
        limit: 50,
        offset: 0,
        callLogs: [
          activity({
            timestamp: '2026-06-04T00:00:00Z',
            tool: 'storage_get',
            operationTitle: 'Read object',
          }),
        ],
      })
      .mockResolvedValueOnce({
        count: 60,
        limit: 50,
        offset: 50,
        callLogs: [
          activity({
            timestamp: '2026-06-01T00:00:00Z',
            tool: 'storage_delete',
            operationTitle: 'Delete object',
          }),
        ],
      });

    await openActivity();
    expect(container.textContent).toContain('Read object');
    expect(container.textContent).not.toContain('Delete object');

    const more = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Load more',
    );
    expect(more).toBeTruthy();
    await act(async () => {
      more?.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.fetchMcpPersonalAgentCallLogs).toHaveBeenLastCalledWith(
      'https://ai.example',
      'tok',
      'agent-1',
      { limit: 50, offset: 50 },
    );
    expect(container.textContent).toContain('Delete object');
    expect(container.textContent?.indexOf('Read object')).toBeLessThan(
      container.textContent?.indexOf('Delete object') ?? -1,
    );
  });
});
