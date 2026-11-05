import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShellUIConfig } from '../config/types';
import {
  decideMcpToolApproval,
  fetchMcpPendingToolApprovals,
  getMcpSettingsCompanyDisplayName,
  mcpApprovalExpiresInMinutes,
  parseMcpPendingToolApproval,
  parseMcpPendingToolApprovalsList,
} from './mcpToolApprovalsApi';

describe('parseMcpPendingToolApproval', () => {
  it('maps snake_case fields', () => {
    expect(
      parseMcpPendingToolApproval({
        id: 'ap-1',
        tool_name: 'storage_delete',
        agent_name: 'Cursor',
        expires_at: '2026-11-05T16:00:00Z',
        short_action_summary: 'Remove draft.pdf',
        is_destructive: true,
      }),
    ).toMatchObject({
      id: 'ap-1',
      toolName: 'storage_delete',
      agentName: 'Cursor',
      shortActionSummary: 'Remove draft.pdf',
      isDestructive: true,
    });
  });

  it('returns null when required fields are missing', () => {
    expect(parseMcpPendingToolApproval({ id: 'x' })).toBeNull();
  });
});

describe('parseMcpPendingToolApprovalsList', () => {
  it('uses pending_count when provided', () => {
    expect(
      parseMcpPendingToolApprovalsList({
        pending_count: 3,
        approvals: [],
      }),
    ).toEqual({ pendingCount: 3, approvals: [] });
  });

  it('falls back to approvals length', () => {
    const list = parseMcpPendingToolApprovalsList({
      approvals: [
        {
          id: '1',
          tool_name: 't',
          agent_name: 'a',
          expires_at: '2026-11-05T16:00:00Z',
          is_destructive: false,
        },
      ],
    });
    expect(list?.pendingCount).toBe(1);
    expect(list?.approvals).toHaveLength(1);
  });
});

describe('mcpApprovalExpiresInMinutes', () => {
  it('returns at least one minute while time remains', () => {
    const now = Date.parse('2026-11-05T15:00:00Z');
    expect(mcpApprovalExpiresInMinutes('2026-11-05T15:00:30Z', now)).toBe(1);
    expect(mcpApprovalExpiresInMinutes('2026-11-05T15:02:00Z', now)).toBe(2);
  });

  it('returns zero after expiry', () => {
    const now = Date.parse('2026-11-05T16:00:01Z');
    expect(mcpApprovalExpiresInMinutes('2026-11-05T16:00:00Z', now)).toBe(0);
  });
});

describe('getMcpSettingsCompanyDisplayName', () => {
  it('prefers config title', () => {
    expect(getMcpSettingsCompanyDisplayName({ title: 'Acme' } as ShellUIConfig)).toBe('Acme');
  });
});

describe('mcp tool approval fetch helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchMcpPendingToolApprovals sends bearer and company_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pending_count: 0, approvals: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchMcpPendingToolApprovals('https://id.example.com', 'tok', '7');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://id.example.com/api/v1/mcp/personal/tool-approvals/pending?company_id=7',
    );
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('decideMcpToolApproval posts decision', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await decideMcpToolApproval('https://id.example.com', 'tok', '1', 'ap-9', 'deny');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/mcp/personal/tool-approvals/ap-9/decide');
    expect(JSON.parse(String(init.body))).toEqual({ decision: 'deny' });
  });
});
