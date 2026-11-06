import { describe, expect, it } from 'vitest';
import type { McpAgentActivityRow } from './personalAgentsApi';
import {
  buildActivityPrimarySummary,
  formatActivityResultForDisplay,
  parseActivityOutcomeFromFields,
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
  operationTitle: null,
  actorLabel: null,
  agentName: null,
  accessKind: null,
  durationMs: null,
  outcome: null,
  approvalRequestId: null,
  errorMessage: null,
  ...overrides,
});

const labels = { toolUnknown: 'Unknown tool', operationSuffix: 'Operation' };

describe('sanitizeMcpActivityErrorMessage', () => {
  it('redacts entire message when token appears anywhere including URL query', () => {
    expect(sanitizeMcpActivityErrorMessage('failed https://x.test/a?token=secret')).toBe(
      '[Details redacted]',
    );
  });

  it('strips queries from http URLs when no secret markers', () => {
    expect(sanitizeMcpActivityErrorMessage('bad https://api.example.com/v1/x?foo=1')).toBe(
      'bad https://api.example.com/v1/x',
    );
  });

  it('redacts bearer phrases', () => {
    expect(sanitizeMcpActivityErrorMessage('invalid bearer')).toBe('[Details redacted]');
  });
});

describe('parseActivityOutcomeFromFields', () => {
  it('uses exact outcome field tokens only', () => {
    expect(parseActivityOutcomeFromFields('not_allowed', 'denied')).toBe('denied');
    expect(parseActivityOutcomeFromFields('ok', 'not_a_real_outcome')).toBe('unknown');
  });

  it('maps exact result tokens only', () => {
    expect(parseActivityOutcomeFromFields('ok', null)).toBe('allowed');
    expect(parseActivityOutcomeFromFields('pending_approval', null)).toBe('pending_approval');
    expect(parseActivityOutcomeFromFields('not allowed', null)).toBe('unknown');
  });
});

describe('buildActivityPrimarySummary', () => {
  it('prefers operation_title from API', () => {
    const row = baseRow({
      operationTitle: 'List workspace members',
      tool: 'identity_list_users',
      service: 'identity',
    });
    expect(buildActivityPrimarySummary(row, labels)).toBe('List workspace members');
  });

  it('uses allowlisted tool label when known', () => {
    const row = baseRow({
      service: 'storage',
      tool: 'storage_delete',
      resourceLabel: 'Reports',
      companyLabel: 'Acme Corp',
    });
    expect(buildActivityPrimarySummary(row, labels)).toBe(
      'storage Reports: Delete stored object (Acme Corp)',
    );
  });

  it('falls back to Operation {tool} when unknown', () => {
    const row = baseRow({
      service: 'identity',
      tool: 'list_users',
      resourceLabel: 'Members',
    });
    expect(buildActivityPrimarySummary(row, labels)).toBe('identity Members: Operation list_users');
  });
});

describe('formatActivityResultForDisplay', () => {
  it('sanitizes like errors and truncates', () => {
    expect(formatActivityResultForDisplay('ok')).toBe('ok');
    const long = 'x'.repeat(200);
    expect(formatActivityResultForDisplay(long).length).toBeLessThanOrEqual(120);
  });

  it('redacts when token appears in URL query', () => {
    expect(formatActivityResultForDisplay('https://x.test/a?token=1')).toBe('[Details redacted]');
  });
});

describe('resolveActivityPendingLink', () => {
  it('returns id link when approval_request_id set', () => {
    const row = baseRow({
      tool: 'storage_delete',
      result: 'pending_approval',
      approvalRequestId: 'ap-1',
    });
    expect(resolveActivityPendingLink(row, new Set())).toEqual({ type: 'id', approvalId: 'ap-1' });
  });

  it('matches pending outcome to tool name', () => {
    const row = baseRow({
      tool: 'storage_delete',
      result: 'pending_approval',
    });
    expect(resolveActivityPendingLink(row, new Set(['storage_delete']))).toEqual({
      type: 'tool',
      toolName: 'storage_delete',
    });
  });
});
