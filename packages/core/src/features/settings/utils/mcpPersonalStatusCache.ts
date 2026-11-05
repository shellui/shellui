import type { McpPersonalStatus } from '../../mcp/personalAgentsApi';

export const MCP_PERSONAL_STATUS_CACHE_KEY = 'shellui:mcp-personal-status';

export type McpPersonalStatusCacheScope = {
  userId: string;
  backendUrl: string;
  companyId: string;
};

type McpPersonalStatusCacheEntry = McpPersonalStatusCacheScope & {
  mcpEnabled: boolean;
  mcpUrl: string | null;
  globalIdentity?: boolean;
  fetchedAt: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

const parseCacheEntry = (raw: string): McpPersonalStatusCacheEntry | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const userId = typeof parsed.userId === 'string' ? parsed.userId : '';
    const backendUrl = typeof parsed.backendUrl === 'string' ? parsed.backendUrl : '';
    const companyId = typeof parsed.companyId === 'string' ? parsed.companyId : '';
    if (!userId || !backendUrl) return null;
    if (typeof parsed.mcpEnabled !== 'boolean') return null;
    const mcpUrl =
      parsed.mcpUrl === null ? null : typeof parsed.mcpUrl === 'string' ? parsed.mcpUrl : null;
    const globalIdentity =
      typeof parsed.globalIdentity === 'boolean' ? parsed.globalIdentity : undefined;
    const fetchedAt = typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : 0;
    return {
      userId,
      backendUrl,
      companyId,
      mcpEnabled: parsed.mcpEnabled,
      mcpUrl,
      ...(globalIdentity !== undefined ? { globalIdentity } : {}),
      fetchedAt,
    };
  } catch {
    return null;
  }
};

const scopesMatch = (a: McpPersonalStatusCacheScope, b: McpPersonalStatusCacheScope): boolean =>
  a.userId === b.userId && a.backendUrl === b.backendUrl && a.companyId === b.companyId;

export const readMcpPersonalStatusCache = (
  scope: McpPersonalStatusCacheScope,
): McpPersonalStatus | null => {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(MCP_PERSONAL_STATUS_CACHE_KEY);
  if (!raw) return null;
  const entry = parseCacheEntry(raw);
  if (!entry || !scopesMatch(entry, scope)) return null;
  return {
    mcpEnabled: entry.mcpEnabled,
    mcpUrl: entry.mcpUrl,
    ...(entry.globalIdentity !== undefined ? { globalIdentity: entry.globalIdentity } : {}),
  };
};

export const writeMcpPersonalStatusCache = (
  scope: McpPersonalStatusCacheScope,
  status: McpPersonalStatus,
): void => {
  if (typeof sessionStorage === 'undefined') return;
  const entry: McpPersonalStatusCacheEntry = {
    ...scope,
    mcpEnabled: status.mcpEnabled,
    mcpUrl: status.mcpUrl,
    ...(status.globalIdentity !== undefined ? { globalIdentity: status.globalIdentity } : {}),
    fetchedAt: Date.now(),
  };
  sessionStorage.setItem(MCP_PERSONAL_STATUS_CACHE_KEY, JSON.stringify(entry));
};

export const clearMcpPersonalStatusCache = (): void => {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(MCP_PERSONAL_STATUS_CACHE_KEY);
};
