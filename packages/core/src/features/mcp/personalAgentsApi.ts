import type { ShellUIConfig } from '../config/types';
import { getShellUILoginCompanyId } from '../auth/utils/clientLoginContext';

export type McpAgentKind = 'oauth' | 'personal';
export type McpAccessMode = 'read_only' | 'ask' | 'full';
export type McpReadLevel = 'safe' | 'sensitive';

/** Selectable services for personal agent tokens (`ai` is always added server-side). */
export const MCP_PERSONAL_SERVICE_OPTIONS = [
  'identity',
  'storage',
  'hosting',
  'email',
  'saas',
] as const;

export type McpPersonalService = (typeof MCP_PERSONAL_SERVICE_OPTIONS)[number];

export type McpPersonalStatus = {
  mcpEnabled: boolean;
  mcpUrl: string | null;
  /** When false, the signed-in session is regional-only (no saas grant). */
  globalIdentity?: boolean;
};

export type McpAgentSummary = {
  id: string;
  kind: McpAgentKind;
  name: string;
  accessMode: McpAccessMode;
  readLevel: McpReadLevel;
  allowDestructiveWithoutAsking: boolean;
  servicesAllowed: string[];
  expiresAt: string | null;
  pausedAt: string | null;
  revokedAt: string | null;
  isActive: boolean;
  createdAt: string;
  oauthClientId: string | null;
  personalTokenId: string | null;
};

export type McpActivityAccessKind = 'read' | 'write' | 'destructive' | 'unknown';

export type McpActivityOutcomeKind =
  | 'allowed'
  | 'denied'
  | 'failed'
  | 'pending_approval'
  | 'session_used'
  | 'unknown';

export type McpAgentActivityRow = {
  timestamp: string;
  tool: string;
  service: string;
  result: string;
  clientIp: string | null;
  /** When the row refers to a specific company (often global MCP). */
  companyId: string | null;
  /** Human label for the company when the API provides one. */
  companyLabel: string | null;
  /** Safe description of the target resource (no secrets, query strings, or raw args). */
  resourceLabel: string | null;
  /** Actor that performed the action when provided by the API. */
  actorLabel: string | null;
  /** Connected agent or client name when provided. */
  agentName: string | null;
  /** Explicit access classification when provided. */
  accessKind: McpActivityAccessKind | null;
  /** Request duration in milliseconds when provided. */
  durationMs: number | null;
  /** Machine-readable outcome when provided (preferred over inferring from `result`). */
  outcome: McpActivityOutcomeKind | null;
  /** Linked pending approval id when provided (matches approvals list). */
  approvalRequestId: string | null;
  /** Safe, concise service error text when provided (already redacted server-side when possible). */
  errorMessage: string | null;
};

export type CreatePersonalAgentInput = {
  name: string;
  services: McpPersonalService[];
  accessMode: McpAccessMode;
  readLevel: McpReadLevel;
  allowDestructive: boolean;
  expiresAt: string;
};

export type CreatePersonalAgentResult = {
  agent: McpAgentSummary;
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  resource: string;
};

export const getShellIdentityBackendUrl = (config: ShellUIConfig | undefined): string | null => {
  if (config?.backend?.type !== 'shellui') return null;
  const url = config.backend.url?.trim().replace(/\/+$/, '') || '';
  return url || null;
};

export const getMcpPersonalCompanyId = (config: ShellUIConfig | undefined): string => {
  return getShellUILoginCompanyId(config?.backend?.companyId);
};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const asBool = (value: unknown): boolean => value === true;

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
};

export const parseMcpPersonalStatus = (payload: unknown): McpPersonalStatus | null => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.mcp_enabled !== 'boolean') return null;
  const mcpUrl = asString(record.mcp_url);
  const globalIdentity =
    typeof record.global_identity === 'boolean' ? record.global_identity : undefined;
  return {
    mcpEnabled: record.mcp_enabled,
    mcpUrl,
    ...(globalIdentity !== undefined ? { globalIdentity } : {}),
  };
};

export const parseMcpAgentSummary = (value: unknown): McpAgentSummary | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = asString(record.id);
  const kind = asString(record.kind);
  const name = asString(record.name);
  const accessMode = asString(record.access_mode);
  const readLevel = asString(record.read_level);
  const createdAt = asString(record.created_at);
  if (!id || !kind || !name || !accessMode || !readLevel || !createdAt) return null;
  if (kind !== 'oauth' && kind !== 'personal') return null;
  if (accessMode !== 'read_only' && accessMode !== 'ask' && accessMode !== 'full') return null;
  if (readLevel !== 'safe' && readLevel !== 'sensitive') return null;
  return {
    id,
    kind,
    name,
    accessMode,
    readLevel,
    allowDestructiveWithoutAsking: asBool(record.allow_destructive_without_asking),
    servicesAllowed: asStringArray(record.services_allowed),
    expiresAt: asString(record.expires_at),
    pausedAt: asString(record.paused_at),
    revokedAt: asString(record.revoked_at),
    isActive: asBool(record.is_active),
    createdAt,
    oauthClientId: asString(record.oauth_client_id),
    personalTokenId: asString(record.personal_token_id),
  };
};

export const parseMcpAgentList = (payload: unknown): McpAgentSummary[] => {
  if (!payload || typeof payload !== 'object') return [];
  const agents = (payload as Record<string, unknown>).agents;
  if (!Array.isArray(agents)) return [];
  return agents
    .map((row) => parseMcpAgentSummary(row))
    .filter((row): row is McpAgentSummary => row !== null);
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const parseAccessKind = (value: unknown): McpActivityAccessKind | null => {
  const s = asString(value)?.toLowerCase();
  if (!s) return null;
  if (s === 'read' || s === 'read_only' || s === 'readonly') return 'read';
  if (s === 'write' || s === 'mutate' || s === 'mutation') return 'write';
  if (s === 'destructive' || s === 'destructive_write' || s === 'delete') return 'destructive';
  if (s === 'unknown') return 'unknown';
  return null;
};

const parseOutcomeKind = (value: unknown): McpActivityOutcomeKind | null => {
  const s = asString(value)
    ?.toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!s) return null;
  if (s === 'allowed' || s === 'ok' || s === 'success') return 'allowed';
  if (s === 'denied' || s === 'forbidden') return 'denied';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'pending' || s === 'pending_approval' || s === 'awaiting_approval')
    return 'pending_approval';
  if (s === 'session_used' || s === 'session') return 'session_used';
  if (s === 'unknown') return 'unknown';
  return null;
};

export const parseMcpAgentActivity = (
  payload: unknown,
): { agentId: string; activity: McpAgentActivityRow[] } | null => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const agentId = asString(record.agent_id);
  if (!agentId) return null;
  const rows = Array.isArray(record.activity) ? record.activity : [];
  const activity: McpAgentActivityRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const timestamp = asString(item.timestamp);
    const tool = asString(item.tool);
    const service = asString(item.service);
    const result = asString(item.result);
    if (!timestamp || !tool || !service || !result) continue;
    const durationRaw = asNumber(item.duration_ms);
    activity.push({
      timestamp,
      tool,
      service,
      result,
      clientIp: asString(item.client_ip),
      companyId: asString(item.company_id),
      companyLabel: asString(item.company_name),
      resourceLabel: asString(item.resource_label),
      actorLabel: asString(item.actor),
      agentName: asString(item.agent_name),
      accessKind: parseAccessKind(item.access_kind),
      durationMs: durationRaw,
      outcome: parseOutcomeKind(item.outcome),
      approvalRequestId: asString(item.approval_request_id),
      errorMessage: asString(item.error_message),
    });
  }
  return { agentId, activity };
};

export const parseCreatePersonalAgentResult = (
  payload: unknown,
): CreatePersonalAgentResult | null => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const agent = parseMcpAgentSummary(record.agent);
  const accessToken = asString(record.access_token);
  const tokenType = asString(record.token_type);
  const expiresAt = asString(record.expires_at);
  const resource = asString(record.resource);
  if (!agent || !accessToken || !tokenType || !expiresAt || !resource) return null;
  return { agent, accessToken, tokenType, expiresAt, resource };
};

export class McpPersonalApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'McpPersonalApiError';
    this.status = status;
  }
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

export const fetchMcpPersonalStatus = (
  backendUrl: string,
  accessToken: string,
  companyId: string,
): Promise<McpPersonalStatus> =>
  mcpJsonRequest(
    backendUrl,
    accessToken,
    companyId,
    '/api/v1/mcp/personal/status',
    { method: 'GET' },
    parseMcpPersonalStatus,
  );

export const fetchMcpPersonalAgents = (
  backendUrl: string,
  accessToken: string,
  companyId: string,
): Promise<McpAgentSummary[]> =>
  mcpJsonRequest(
    backendUrl,
    accessToken,
    companyId,
    '/api/v1/mcp/personal/agents',
    { method: 'GET' },
    (payload) => parseMcpAgentList(payload),
  );

export type CreateMcpPersonalAgentOptions = {
  /** When false, `saas` is removed from the request (regional identity surfaces). */
  allowSaas?: boolean;
};

export const createMcpPersonalAgent = (
  backendUrl: string,
  accessToken: string,
  companyId: string,
  input: CreatePersonalAgentInput,
  options: CreateMcpPersonalAgentOptions = {},
): Promise<CreatePersonalAgentResult> => {
  const allowSaas = options.allowSaas === true;
  const services = allowSaas
    ? input.services
    : input.services.filter((service) => service !== 'saas');
  return mcpJsonRequest(
    backendUrl,
    accessToken,
    companyId,
    '/api/v1/mcp/personal/agents/create',
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        services,
        access_mode: input.accessMode,
        read_level: input.readLevel,
        allow_destructive: input.allowDestructive,
        expires_at: input.expiresAt,
      }),
    },
    parseCreatePersonalAgentResult,
  );
};

export const revokeMcpPersonalAgent = (
  backendUrl: string,
  accessToken: string,
  companyId: string,
  agentId: string,
): Promise<McpAgentSummary> =>
  mcpJsonRequest(
    backendUrl,
    accessToken,
    companyId,
    `/api/v1/mcp/personal/agents/${encodeURIComponent(agentId)}/revoke`,
    { method: 'POST' },
    (payload) => {
      if (!payload || typeof payload !== 'object') return null;
      return parseMcpAgentSummary((payload as Record<string, unknown>).agent);
    },
  );

export const fetchMcpPersonalAgentActivity = (
  backendUrl: string,
  accessToken: string,
  companyId: string,
  agentId: string,
): Promise<McpAgentActivityRow[]> =>
  mcpJsonRequest(
    backendUrl,
    accessToken,
    companyId,
    `/api/v1/mcp/personal/agents/${encodeURIComponent(agentId)}/activity`,
    { method: 'GET' },
    (payload) => parseMcpAgentActivity(payload)?.activity ?? null,
  );
