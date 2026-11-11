import { describe, expect, it } from 'vitest';
import { mergeMcpAgentActivity } from './mcpAgentActivityMerge';
import type { McpAgentActivityRow } from './personalAgentsApi';

const row = (overrides: Partial<McpAgentActivityRow>): McpAgentActivityRow => ({
  timestamp: '2026-06-01T00:00:00Z',
  tool: 'storage_list_bucket',
  service: 'storage',
  result: 'ok',
  clientIp: null,
  companyId: '1',
  companyLabel: 'Acme',
  resourceLabel: null,
  operationTitle: null,
  actorLabel: null,
  agentName: null,
  accessKind: 'read',
  durationMs: null,
  outcome: 'allowed',
  approvalRequestId: null,
  errorCode: null,
  ...overrides,
});

describe('mergeMcpAgentActivity', () => {
  const consent = row({
    timestamp: '2026-06-03T00:00:00Z',
    tool: 'oauth.authorize.approved',
    service: 'identity',
    result: 'ok',
    companyLabel: null,
  });
  const device = row({
    timestamp: '2026-05-01T00:00:00Z',
    tool: 'oauth.device.approved',
    service: 'identity',
    result: 'ok',
  });
  const staleCall = row({
    timestamp: '2026-06-02T00:00:00Z',
    tool: 'identity_list_users',
    service: 'identity',
  });
  const newerCall = row({
    timestamp: '2026-06-04T00:00:00Z',
    tool: 'storage_get',
    service: 'storage',
    companyLabel: null,
  });
  const olderCall = row({
    timestamp: '2026-06-02T12:00:00Z',
    tool: 'storage_list_bucket',
    service: 'storage',
    companyLabel: null,
  });

  it('drops identity call rows, keeps consent, and sorts newest first', () => {
    const merged = mergeMcpAgentActivity([staleCall, device, consent], [olderCall, newerCall], {
      callLogsComplete: true,
    });
    expect(merged.map((item) => item.tool)).toEqual([
      'storage_get',
      'oauth.authorize.approved',
      'storage_list_bucket',
      'oauth.device.approved',
    ]);
  });

  it('hides consent older than the loaded call-log page until the list is complete', () => {
    const recentConsent = row({
      timestamp: '2026-06-05T00:00:00Z',
      tool: 'oauth.authorize.approved',
      service: 'identity',
      result: 'ok',
      companyLabel: null,
    });
    const partial = mergeMcpAgentActivity([recentConsent, device], [newerCall], {
      callLogsComplete: false,
    });
    expect(partial.map((item) => item.tool)).toEqual(['oauth.authorize.approved', 'storage_get']);

    const done = mergeMcpAgentActivity([recentConsent, device], [newerCall], {
      callLogsComplete: true,
    });
    expect(done.map((item) => item.tool)).toEqual([
      'oauth.authorize.approved',
      'storage_get',
      'oauth.device.approved',
    ]);
  });
});
