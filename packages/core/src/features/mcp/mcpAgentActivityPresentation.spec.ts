import { describe, expect, it } from 'vitest';
import type { McpAgentActivityRow } from './personalAgentsApi';
import {
  buildActivityPrimarySummary,
  formatActivityResultForDisplay,
  isRecognizedActivityResultToken,
  parseActivityOutcomeFromFields,
  resolveActivityPendingLink,
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
  errorCode: null,
  errorDetailRaw: null,
  ...overrides,
});

const labels = { toolUnknown: 'Unknown tool', operationSuffix: 'Operation' };

describe('parseActivityOutcomeFromFields', () => {
  it('prefers parsed outcome from API when set', () => {
    expect(parseActivityOutcomeFromFields('not_allowed', 'denied')).toBe('denied');
    expect(parseActivityOutcomeFromFields('ok', 'allowed')).toBe('allowed');
  });

  it('uses unknown explicit outcome even when result looks mappable', () => {
    expect(parseActivityOutcomeFromFields('ok', 'unknown')).toBe('unknown');
  });

  it('maps exact result tokens only when outcome is null', () => {
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

  it('falls back to Operation {tool} when not humanized', () => {
    const row = baseRow({
      service: 'identity',
      tool: 'list_users',
      resourceLabel: 'Members',
    });
    expect(buildActivityPrimarySummary(row, labels)).toBe('identity Members: Operation list_users');
  });
});

describe('formatActivityResultForDisplay', () => {
  it('returns token only when recognized', () => {
    expect(formatActivityResultForDisplay('ok')).toBe('ok');
    expect(formatActivityResultForDisplay('PENDING_APPROVAL')).toBe('pending_approval');
  });

  it('returns null for unrecognized provider strings', () => {
    expect(formatActivityResultForDisplay('upstream said nope')).toBeNull();
    expect(formatActivityResultForDisplay('https://x.test/a?token=1')).toBeNull();
  });
});

describe('isRecognizedActivityResultToken', () => {
  it('flags only allowlisted keys', () => {
    expect(isRecognizedActivityResultToken('ok')).toBe(true);
    expect(isRecognizedActivityResultToken('nope')).toBe(false);
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
