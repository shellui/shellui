import {
  MCP_PERSONAL_SERVICE_OPTIONS,
  type McpAgentSummary,
  type McpPersonalService,
  type McpPersonalStatus,
} from './personalAgentsApi';

/** Regional services selectable for personal agent tokens (`ai` is added server-side). */
export const MCP_REGIONAL_PERSONAL_SERVICES = MCP_PERSONAL_SERVICE_OPTIONS.filter(
  (service): service is Exclude<McpPersonalService, 'saas'> => service !== 'saas',
);

export function buildCompanyMcpUrl(
  aiServiceUrl: string | null | undefined,
  companyId: string,
  fallbackUrl?: string | null,
): string | null {
  const base = aiServiceUrl?.trim().replace(/\/+$/, '') || '';
  const tenant = companyId.trim();
  if (base && tenant) {
    return `${base}/c/${encodeURIComponent(tenant)}/mcp`;
  }
  const fallback = fallbackUrl?.trim();
  return fallback || null;
}

export function isGlobalIdentitySession(status: McpPersonalStatus | null): boolean {
  return status?.globalIdentity === true;
}

export function getDefaultPersonalAgentServices(includeSaas: boolean): McpPersonalService[] {
  const services: McpPersonalService[] = [...MCP_REGIONAL_PERSONAL_SERVICES];
  if (includeSaas) {
    services.push('saas');
  }
  return services;
}

export function buildAgentPrompt(mcpUrl: string, accessToken: string): string {
  return [
    'Connect to this Shellui company over MCP.',
    '',
    `MCP URL: ${mcpUrl}`,
    `Access token: ${accessToken}`,
    '',
    "Use the URL as the MCP server endpoint and send the token as the bearer credential. Prefer the company's configured OAuth flow when the client supports it; use this token when the client needs a static secret.",
  ].join('\n');
}

export function formatDefaultAgentName(locale: string, at: Date = new Date()): string {
  let dateLabel: string;
  try {
    dateLabel = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(at);
  } catch {
    dateLabel = at.toISOString().slice(0, 10);
  }
  return `Agent · ${dateLabel}`;
}

export function formatConnectionDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatAgentExpiry(iso: string | null, locale: string): string | null {
  if (!iso?.trim()) return null;
  return formatConnectionDate(iso, locale);
}

export function isActiveMcpConnection(agent: McpAgentSummary, nowMs = Date.now()): boolean {
  if (agent.revokedAt) return false;
  if (!agent.isActive) return false;
  if (agent.expiresAt && new Date(agent.expiresAt).getTime() <= nowMs) return false;
  return true;
}

export function agentIncludesSaasScope(agent: McpAgentSummary): boolean {
  return agent.servicesAllowed.some((service) => service.toLowerCase() === 'saas');
}

/**
 * Identity `MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS` default (clamped to 1..366 days).
 * `POST /api/v1/mcp/personal/agents/create` rejects a later `expires_at`.
 * Personal status does not return the live setting, so the client uses this default.
 */
export const MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS = 90;

const DAY_MS = 86_400_000;

/**
 * Stay strictly inside Identity's `expires_at > now + max` check when the browser
 * clock is a little ahead of the server.
 */
const PERSONAL_AGENT_EXPIRY_SKEW_MS = 60_000;

/** Default personal-agent expiry when the UI does not expose a picker. */
export function defaultPersonalAgentExpiresAt(fromMs = Date.now()): string {
  const lifetimeMs = MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS * DAY_MS - PERSONAL_AGENT_EXPIRY_SKEW_MS;
  return new Date(fromMs + lifetimeMs).toISOString();
}
