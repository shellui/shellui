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
  /**
   * Full global MCP URL from identity: trusted `DASHBOARD_PUBLIC_URL` without a trailing slash, plus `/mcp`.
   * Validated http(s) URL with path `/mcp` only. Identity may omit until ready. Use as the direct MCP endpoint in UI.
   */
  globalMcpUrl: string | null;
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

/**
 * Identity `error_code` for activity rows: fixed allowlist from identity (and gateway when present).
 * Parse accepts only these tokens (contract tests); settings maps each to translated labels only.
 */
export type McpActivityErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'denied'
  | 'expired'
  | 'timeout'
  | 'upstream_error'
  | 'internal_error'
  | 'out_of_sync'
  | 'identity_unreachable'
  | 'identity_unavailable'
  | 'identity_invalid'
  | 'invalid_grant'
  | 'permission_changed'
  | 'request_expired'
  | 'agent_revoked'
  | 'downstream_error'
  | 'server_error'
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
  /** Human title for the operation when identity sends it (preferred over local tool registry). */
  operationTitle: string | null;
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
  /** Allowlisted machine error from identity or ai-service; UI maps to translated labels only. */
  errorCode: McpActivityErrorCode | null;
  /**
   * Redacted failure text from an ai-service call log.
   * Identity activity parsing leaves this unset.
   */
  errorMessage?: string | null;
  /** Set when the gateway ran the tool through a wrapper such as `ai_call_tool`. */
  wrapperTool?: string | null;
  /** Stored approval result, such as `accepted`, `denied`, or `session_used`. */
  approvalOutcome?: string | null;
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

/**
 * Identity `global_mcp_url`: full MCP endpoint `https?://host/mcp` (no query, hash, userinfo).
 * Rejects a bare origin, `/mcp/mcp`, or any path other than `/mcp`.
 */
export function parseValidatedGlobalMcpEndpointUrl(raw: unknown): string | null {
  const s = asString(raw);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    if (u.search || u.hash) return null;
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/';
    if (path !== '/mcp') return null;
    return `${u.origin}/mcp`;
  } catch {
    return null;
  }
}

export const parseMcpPersonalStatus = (payload: unknown): McpPersonalStatus | null => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.mcp_enabled !== 'boolean') return null;
  const mcpUrl = asString(record.mcp_url);
  const globalMcpUrl = parseValidatedGlobalMcpEndpointUrl(record.global_mcp_url);
  const globalIdentity =
    typeof record.global_identity === 'boolean' ? record.global_identity : undefined;
  return {
    mcpEnabled: record.mcp_enabled,
    mcpUrl,
    globalMcpUrl,
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

const normEnum = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

/** Identity `access_kind`: exact tokens only. */
const parseAccessKind = (value: unknown): McpActivityAccessKind | null => {
  const s = asString(value);
  if (!s) return null;
  const n = normEnum(s);
  if (n === 'read' || n === 'read_only' || n === 'readonly') return 'read';
  if (n === 'write') return 'write';
  if (n === 'destructive') return 'destructive';
  if (n === 'unknown') return 'unknown';
  return null;
};

/** Identity `outcome`: exact tokens only (no substring matching). */
export const parseStrictMcpActivityOutcome = (value: unknown): McpActivityOutcomeKind | null => {
  const s = asString(value);
  if (!s) return null;
  const n = normEnum(s);
  if (
    n === 'allowed' ||
    n === 'ok' ||
    n === 'success' ||
    n === 'allow' ||
    n === 'allow_success' ||
    n === 'allowed_success'
  )
    return 'allowed';
  if (n === 'denied' || n === 'forbidden') return 'denied';
  if (n === 'failed' || n === 'error') return 'failed';
  if (
    n === 'pending' ||
    n === 'pending_approval' ||
    n === 'awaiting_approval' ||
    n === 'waiting_approval'
  )
    return 'pending_approval';
  if (n === 'session_used' || n === 'session') return 'session_used';
  if (n === 'unknown') return 'unknown';
  return null;
};

export const MCP_ACTIVITY_ERROR_CODES: readonly McpActivityErrorCode[] = [
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'denied',
  'expired',
  'timeout',
  'upstream_error',
  'internal_error',
  'out_of_sync',
  'identity_unreachable',
  'identity_unavailable',
  'identity_invalid',
  'invalid_grant',
  'permission_changed',
  'request_expired',
  'agent_revoked',
  'downstream_error',
  'server_error',
  'unknown',
] as const;

export const parseStrictMcpActivityErrorCode = (value: unknown): McpActivityErrorCode | null => {
  const s = asString(value);
  if (!s) return null;
  const n = normEnum(s);
  return (MCP_ACTIVITY_ERROR_CODES as readonly string[]).includes(n)
    ? (n as McpActivityErrorCode)
    : null;
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
    const durationMs =
      durationRaw !== null && durationRaw >= 0 && Number.isFinite(durationRaw) ? durationRaw : null;
    activity.push({
      timestamp,
      tool,
      service,
      result,
      clientIp: asString(item.client_ip),
      companyId: asString(item.company_id),
      companyLabel: asString(item.company_name),
      resourceLabel: asString(item.resource_label),
      operationTitle: asString(item.operation_title),
      actorLabel: asString(item.actor),
      agentName: asString(item.agent_name),
      accessKind: parseAccessKind(item.access_kind),
      durationMs,
      outcome: parseStrictMcpActivityOutcome(item.outcome),
      approvalRequestId: asString(item.approval_request_id),
      errorCode: parseStrictMcpActivityErrorCode(item.error_code),
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

/** Default page size for `GET /ai/v1/mcp/personal/agents/{id}/call-logs`. */
export const MCP_PERSONAL_CALL_LOG_PAGE_SIZE = 50;

const MCP_PERSONAL_CALL_LOG_MAX_PAGE_SIZE = 200;

export type McpPersonalCallLogPage = {
  count: number;
  limit: number;
  offset: number;
  callLogs: McpAgentActivityRow[];
};

export type FetchMcpPersonalCallLogsOptions = {
  limit?: number;
  offset?: number;
};

const clampPageLimit = (value: number | undefined): number => {
  const raw = value ?? MCP_PERSONAL_CALL_LOG_PAGE_SIZE;
  if (!Number.isFinite(raw)) return MCP_PERSONAL_CALL_LOG_PAGE_SIZE;
  return Math.min(MCP_PERSONAL_CALL_LOG_MAX_PAGE_SIZE, Math.max(1, Math.floor(raw)));
};

const clampPageOffset = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const asCompanyId = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  return asString(value);
};

/** Map one ai-service call log onto the activity row the settings list already renders. */
export const parseMcpCallLogActivityRow = (value: unknown): McpAgentActivityRow | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const timestamp = asString(item.created_at);
  const tool = asString(item.tool_name);
  if (!timestamp || !tool) return null;
  const outcome =
    parseStrictMcpActivityOutcome(item.outcome) ?? parseStrictMcpActivityOutcome(item.status);
  const result = asString(item.outcome) ?? asString(item.status) ?? '';
  const durationRaw = asNumber(item.duration_ms);
  const durationMs =
    durationRaw !== null && durationRaw >= 0 && Number.isFinite(durationRaw) ? durationRaw : null;
  const errorMessage = asString(item.error_message);
  const wrapperTool = asString(item.wrapper_tool);
  const approvalOutcome = asString(item.approval_outcome);
  return {
    timestamp,
    tool,
    service: asString(item.service) ?? '',
    result,
    clientIp: null,
    companyId: asCompanyId(item.company_id),
    companyLabel: null,
    resourceLabel: asString(item.resource_label),
    operationTitle: asString(item.operation_title),
    actorLabel: asString(item.user_email),
    agentName: asString(item.agent_name),
    accessKind: parseAccessKind(item.access_kind),
    durationMs,
    outcome,
    approvalRequestId: asString(item.approval_id),
    errorCode: parseStrictMcpActivityErrorCode(item.error_code),
    ...(errorMessage ? { errorMessage } : {}),
    ...(wrapperTool ? { wrapperTool } : {}),
    ...(approvalOutcome ? { approvalOutcome } : {}),
  };
};

export const parseMcpPersonalCallLogPage = (payload: unknown): McpPersonalCallLogPage | null => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const { count, limit, offset } = record;
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return null;
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1 || limit > 200) return null;
  if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) return null;
  if (!Array.isArray(record.call_logs)) return null;
  const callLogs = record.call_logs
    .map((row) => parseMcpCallLogActivityRow(row))
    .filter((row): row is McpAgentActivityRow => row !== null);
  return { count, limit, offset, callLogs };
};

export const mcpCallLogPageHasMore = (
  page: Pick<McpPersonalCallLogPage, 'count' | 'limit' | 'offset'>,
): boolean => page.offset + page.limit < page.count;

/** ai-service did not return a call-log page. A 404 is an empty page, not this error. */
export class McpCallLogUnavailableError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'McpCallLogUnavailableError';
    this.status = status;
  }
}

const emptyCallLogPage = (limit: number, offset: number): McpPersonalCallLogPage => ({
  count: 0,
  limit,
  offset,
  callLogs: [],
});

/**
 * Tool calls for one personal or OAuth agent.
 * `GET {ai-service}/ai/v1/mcp/personal/agents/{agent_id}/call-logs`.
 * The app JWT carries the user and company. A 404 means this caller has no rows.
 */
export const fetchMcpPersonalAgentCallLogs = async (
  aiServiceUrl: string,
  accessToken: string,
  agentId: string,
  options: FetchMcpPersonalCallLogsOptions = {},
): Promise<McpPersonalCallLogPage> => {
  const limit = clampPageLimit(options.limit);
  const offset = clampPageOffset(options.offset);
  const agent = agentId.trim();
  if (!agent) {
    throw new McpCallLogUnavailableError('Missing agent id.', null);
  }

  let url: URL;
  try {
    const base = aiServiceUrl.trim().replace(/\/+$/, '');
    url = new URL(`${base}/ai/v1/mcp/personal/agents/${encodeURIComponent(agent)}/call-logs`);
  } catch {
    throw new McpCallLogUnavailableError('ai-service URL is not usable.', null);
  }
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new McpCallLogUnavailableError('ai-service unreachable', null);
  }

  if (response.status === 404) {
    return emptyCallLogPage(limit, offset);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new McpCallLogUnavailableError(`HTTP ${response.status}`, response.status);
  }
  const parsed = parseMcpPersonalCallLogPage(payload);
  if (!parsed) {
    throw new McpCallLogUnavailableError('Unexpected response from ai-service.', response.status);
  }
  return parsed;
};
