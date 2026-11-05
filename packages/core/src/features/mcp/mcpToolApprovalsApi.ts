import type { ShellUIConfig } from '../config/types';
import { getShellUILoginCompanyId } from '../auth/utils/clientLoginContext';
import { McpPersonalApiError } from './personalAgentsApi';

export type McpToolApprovalDecision = 'approve' | 'deny';

export type McpPendingToolApproval = {
  id: string;
  toolName: string;
  agentName: string;
  expiresAt: string;
  shortActionSummary: string | null;
  isDestructive: boolean;
};

export type McpPendingToolApprovalsList = {
  pendingCount: number;
  approvals: McpPendingToolApproval[];
};

export { getMcpPersonalCompanyId, getShellIdentityBackendUrl } from './personalAgentsApi';

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const asBool = (value: unknown): boolean => value === true;

export const parseMcpPendingToolApproval = (value: unknown): McpPendingToolApproval | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = asString(record.id);
  const toolName = asString(record.tool_name);
  const agentName = asString(record.agent_name);
  const expiresAt = asString(record.expires_at);
  if (!id || !toolName || !agentName || !expiresAt) return null;
  const summary = asString(record.short_action_summary);
  return {
    id,
    toolName,
    agentName,
    expiresAt,
    shortActionSummary: summary,
    isDestructive: asBool(record.is_destructive),
  };
};

export const parseMcpPendingToolApprovalsList = (
  payload: unknown,
): McpPendingToolApprovalsList | null => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const rows = Array.isArray(record.approvals) ? record.approvals : [];
  const approvals = rows
    .map((row) => parseMcpPendingToolApproval(row))
    .filter((row): row is McpPendingToolApproval => row !== null);
  const rawCount = record.pending_count;
  const pendingCount =
    typeof rawCount === 'number' && Number.isFinite(rawCount) && rawCount >= 0
      ? rawCount
      : approvals.length;
  return { pendingCount, approvals };
};

/** Minutes until expiry, at least 1 while time remains. */
export function mcpApprovalExpiresInMinutes(expiresAt: string, nowMs = Date.now()): number {
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(end)) return 0;
  const remainingMs = end - nowMs;
  if (remainingMs <= 0) return 0;
  return Math.max(1, Math.ceil(remainingMs / 60_000));
}

const buildUrl = (backendUrl: string, path: string, companyId: string): URL => {
  const url = new URL(`${backendUrl.replace(/\/+$/, '')}${path}`);
  if (companyId) {
    url.searchParams.set('company_id', companyId);
  }
  return url;
};

async function mcpJsonRequest<T>(
  backendUrl: string,
  accessToken: string,
  companyId: string,
  path: string,
  init: RequestInit,
  parse: (payload: unknown) => T | null,
): Promise<T> {
  const url = buildUrl(backendUrl, path, companyId);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  if (init.body) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url.toString(), {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const err = record.error ?? record.detail;
      if (typeof err === 'string' && err.trim()) message = err.trim();
    }
    throw new McpPersonalApiError(message, response.status);
  }
  const parsed = parse(payload);
  if (!parsed) {
    throw new McpPersonalApiError('Unexpected response from identity.', response.status);
  }
  return parsed;
}

/**
 * Identity member API. OpenAPI: GET /api/v1/mcp/approvals
 */
export const fetchMcpPendingToolApprovals = (
  backendUrl: string,
  accessToken: string,
  companyId: string,
): Promise<McpPendingToolApprovalsList> =>
  mcpJsonRequest(
    backendUrl,
    accessToken,
    companyId,
    '/api/v1/mcp/approvals',
    { method: 'GET' },
    parseMcpPendingToolApprovalsList,
  );

/**
 * Identity member API. OpenAPI: POST /api/v1/mcp/approvals/{id}/decide
 */
export const decideMcpToolApproval = (
  backendUrl: string,
  accessToken: string,
  companyId: string,
  approvalId: string,
  decision: McpToolApprovalDecision,
): Promise<void> =>
  mcpJsonRequest(
    backendUrl,
    accessToken,
    companyId,
    `/api/v1/mcp/approvals/${encodeURIComponent(approvalId)}/decide`,
    {
      method: 'POST',
      body: JSON.stringify({ decision }),
    },
    (payload) => (payload === null || typeof payload === 'object' ? {} : null),
  ).then(() => undefined);

export const getMcpSettingsCompanyDisplayName = (config: ShellUIConfig | undefined): string => {
  const title = config?.title?.trim();
  if (title) return title;
  const companyId = getShellUILoginCompanyId(config?.backend?.companyId);
  return companyId || 'this company';
};
