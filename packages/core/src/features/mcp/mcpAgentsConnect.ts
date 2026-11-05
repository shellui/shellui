import type { McpPersonalService, McpAgentSummary, McpPersonalStatus } from './personalAgentsApi';
import { MCP_PERSONAL_SERVICE_OPTIONS } from './personalAgentsApi';

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
  if (typeof status?.globalIdentity === 'boolean') {
    return status.globalIdentity;
  }
  return true;
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

export function isActiveMcpConnection(agent: McpAgentSummary, nowMs = Date.now()): boolean {
  if (agent.revokedAt) return false;
  if (!agent.isActive) return false;
  if (agent.expiresAt && new Date(agent.expiresAt).getTime() <= nowMs) return false;
  return true;
}

export function agentIncludesSaasScope(agent: McpAgentSummary): boolean {
  return agent.servicesAllowed.some((service) => service.toLowerCase() === 'saas');
}

/** Default personal-agent expiry when the UI does not expose a picker (one year). */
export function defaultPersonalAgentExpiresAt(fromMs = Date.now()): string {
  return new Date(fromMs + 365 * 86400000).toISOString();
}
