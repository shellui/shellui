// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../i18n/translations/en/settings.json';
import { McpPendingApprovals } from './McpPendingApprovals';

const api = vi.hoisted(() => ({
  fetchMcpPendingToolApprovals: vi.fn(),
  decideMcpToolApproval: vi.fn(),
}));

vi.mock('../../mcp/mcpToolApprovalsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mcp/mcpToolApprovalsApi')>();
  return {
    ...actual,
    fetchMcpPendingToolApprovals: api.fetchMcpPendingToolApprovals,
    decideMcpToolApproval: api.decideMcpToolApproval,
  };
});

vi.mock('../../config/useConfig', () => ({
  useConfig: () => ({ config: { title: 'Acme' } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string | number>) => {
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
      return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(opts?.[k] ?? ''));
    },
  }),
}));

const dialogMock = vi.fn();
const toastMock = vi.fn();

vi.mock('@shellui/sdk', () => ({
  shellui: {
    dialog: (...args: unknown[]) => dialogMock(...args),
    toast: (...args: unknown[]) => toastMock(...args),
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const futureExpiry = () => new Date(Date.now() + 5 * 60_000).toISOString();

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  dialogMock.mockReset();
  toastMock.mockReset();
  api.fetchMcpPendingToolApprovals.mockReset();
  api.decideMcpToolApproval.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function renderPanel() {
  act(() => {
    root.render(
      <McpPendingApprovals
        backendUrl="https://id.example.com"
        accessToken="tok"
        companyId="1"
        enabled
      />,
    );
  });
}

describe('McpPendingApprovals', () => {
  it('renders pending rows with Wilson copy', async () => {
    api.fetchMcpPendingToolApprovals.mockResolvedValue({
      pendingCount: 1,
      approvals: [
        {
          id: 'ap-1',
          toolName: 'storage_delete',
          agentName: 'ChatGPT on my laptop',
          expiresAt: futureExpiry(),
          shortActionSummary: 'Delete report.pdf',
          isDestructive: true,
        },
      ],
    });

    renderPanel();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Pending approvals');
    expect(container.textContent).toContain('storage_delete');
    expect(container.textContent).toContain('ChatGPT on my laptop');
    expect(container.textContent).toContain('Expires in');
    expect(container.textContent).toContain('Delete report.pdf');
    expect(container.textContent).toContain('Can change data');
    expect(container.textContent).toContain('Approve');
    expect(container.textContent).toContain('Deny');
  });

  it('denies without a confirm dialog', async () => {
    api.fetchMcpPendingToolApprovals.mockResolvedValue({
      pendingCount: 1,
      approvals: [
        {
          id: 'ap-2',
          toolName: 'identity_list_users',
          agentName: 'Agent',
          expiresAt: futureExpiry(),
          shortActionSummary: null,
          isDestructive: false,
        },
      ],
    });
    api.decideMcpToolApproval.mockResolvedValue(undefined);
    api.fetchMcpPendingToolApprovals.mockResolvedValueOnce({
      pendingCount: 1,
      approvals: [
        {
          id: 'ap-2',
          toolName: 'identity_list_users',
          agentName: 'Agent',
          expiresAt: futureExpiry(),
          shortActionSummary: null,
          isDestructive: false,
        },
      ],
    });
    api.fetchMcpPendingToolApprovals.mockResolvedValueOnce({
      pendingCount: 0,
      approvals: [],
    });

    renderPanel();
    await act(async () => {
      await Promise.resolve();
    });

    const denyBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Deny',
    );
    expect(denyBtn).toBeTruthy();
    await act(async () => {
      denyBtn?.click();
      await Promise.resolve();
    });

    expect(dialogMock).not.toHaveBeenCalled();
    expect(api.decideMcpToolApproval).toHaveBeenCalledWith(
      'https://id.example.com',
      'tok',
      '1',
      'ap-2',
      'deny',
    );
  });

  it('opens destructive approve confirm', async () => {
    api.fetchMcpPendingToolApprovals.mockResolvedValue({
      pendingCount: 1,
      approvals: [
        {
          id: 'ap-3',
          toolName: 'hosting_deploy',
          agentName: 'Cursor',
          expiresAt: futureExpiry(),
          shortActionSummary: '',
          isDestructive: true,
        },
      ],
    });

    renderPanel();
    await act(async () => {
      await Promise.resolve();
    });

    const approveBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Approve',
    );
    await act(async () => {
      approveBtn?.click();
    });

    expect(dialogMock).toHaveBeenCalledOnce();
    const dialogArgs = dialogMock.mock.calls[0]?.[0] as {
      title?: string;
      description?: string;
      okLabel?: string;
      cancelLabel?: string;
    };
    expect(dialogArgs.title).toBe('Approve hosting_deploy?');
    expect(dialogArgs.description).toBe('This can change data in Acme.');
    expect(dialogArgs.okLabel).toBe('Approve');
    expect(dialogArgs.cancelLabel).toBe('Cancel');
  });

  it('hides the section when there are no pending items', async () => {
    api.fetchMcpPendingToolApprovals.mockResolvedValue({
      pendingCount: 0,
      approvals: [],
    });

    renderPanel();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain('Pending approvals');
  });
});
