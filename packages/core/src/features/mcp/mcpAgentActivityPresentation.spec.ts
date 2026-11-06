import { describe, expect, it } from 'vitest';
import type { McpAgentActivityRow } from './personalAgentsApi';
import {
  buildActivityPrimarySummary,
  formatActivityResultForDisplay,
  parseActivityOutcome,
  resolveActivityPendingLink,
  sanitizeMcpActivityErrorMessage,
} from './mcpAgentActivityPresentation';

const baseRow = (overrides: Partial<McpAgentActivityRow> = {}): McpAgentActivityRow => ({
  timestamp: '2026-01-01T12:00:00Z',
  tool: 'storage_get',
  service: 'storage',
  result: 'ok',
  clientIp: null,
  companyId: null,
  companyLabel: null,
  resourceLabel: null,
  actorLabel: null,
  agentName: null,
  accessKind: null,
  durationMs: null,
  outcome: null,
  approvalRequestId: null,
  errorMessage: null,
  ...overrides,
});

describe('sanitizeMcpActivityErrorMessage', () => {
  it('strips query strings from URLs', () => {
    expect(sanitizeMcpActivityErrorMessage('https://api.example.com/v1/x?token=secret')).toBe(
      'https://api.example.com/v1/x',
    );
  });

  it('redacts when message mentions secrets', () => {
    expect(sanitizeMcpActivityErrorMessage('invalid bearer token')).toBe(
      '[Error details redacted]',
    );
  });
});

describe('parseActivityOutcome', () => {
  it('prefers explicit outcome', () => {
    expect(parseActivityOutcome('ignored', 'denied')).toBe('denied');
  });

  it('infers pending from result text', () => {
    expect(parseActivityOutcome('pending_approval', null)).toBe('pending_approval');
  });
});

describe('buildActivityPrimarySummary', () => {
  it('includes resource and company when present', () => {
    const row = baseRow({
      service: 'identity',
      tool: 'list_users',
      resourceLabel: 'Members directory',
      companyLabel: 'Acme Corp',
    });
    expect(buildActivityPrimarySummary(row, { toolUnknown: 'Unknown tool' })).toBe(
      'identity Members directory: Unknown tool (Acme Corp)',
    );
  });

  it('uses registry labels for known tools', () => {
    const row = baseRow({
      service: 'storage',
      tool: 'storage_delete',
      resourceLabel: 'Reports',
      companyLabel: 'Acme Corp',
    });
    expect(buildActivityPrimarySummary(row, { toolUnknown: 'Unknown tool' })).toBe(
      'storage Reports: Delete stored object (Acme Corp)',
    );
  });
});

describe('formatActivityResultForDisplay', () => {
  it('maps known result tokens and strips URL queries from raw line', () => {
    expect(formatActivityResultForDisplay('ok')).toEqual({ human: 'Completed', safeRaw: 'ok' });
    expect(formatActivityResultForDisplay('https://x.example/a?q=1')).toEqual({
      human: null,
      safeRaw: 'https://x.example/a',
    });
  });
});

describe('resolveActivityPendingLink', () => {
  it('returns id link even when approval list is empty', () => {
    const row = baseRow({
      tool: 'storage_delete',
      result: 'pending',
      approvalRequestId: 'ap-1',
    });
    const link = resolveActivityPendingLink(row, new Set());
    expect(link).toEqual({ type: 'id', approvalId: 'ap-1' });
  });

  it('matches pending outcome to tool name in list', () => {
    const row = baseRow({
      tool: 'storage_delete',
      result: 'awaiting_approval',
    });
    const link = resolveActivityPendingLink(row, new Set(['storage_delete']));
    expect(link).toEqual({ type: 'tool', toolName: 'storage_delete' });
  });
});
