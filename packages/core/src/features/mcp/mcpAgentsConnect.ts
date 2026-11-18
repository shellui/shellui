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

export function isAbsoluteHttpUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Locales for the copy-paste "Connect an agent" prompt.
 * Admin apps must show these strings unchanged. The prompt names the company
 * MCP URL and OAuth (device login for a headless client or a CLI). It must
 * never include an access token, refresh token, device code, or user code.
 */
export const AGENT_CONNECT_PROMPT_LOCALES = ['en', 'fr'] as const;

export type AgentConnectPromptLocale = (typeof AGENT_CONNECT_PROMPT_LOCALES)[number];

export function resolveAgentConnectPromptLocale(
  language: string | null | undefined,
): AgentConnectPromptLocale {
  const base = language?.toLowerCase().split('-')[0];
  return base === 'fr' ? 'fr' : 'en';
}

/** Exact steps shown under the prompt. Keep in sync with settings.json. */
export const AGENT_CONNECT_STEPS: Record<
  AgentConnectPromptLocale,
  readonly [string, string, string]
> = {
  en: [
    'Paste the prompt into your agent.',
    'Open the link it shows.',
    'Check the code and choose Allow.',
  ],
  fr: [
    "Collez l'invite dans votre agent.",
    "Ouvrez le lien qu'il affiche.",
    'Vérifiez le code, puis choisissez Autoriser.',
  ],
};

function englishAgentPrompt(mcpUrl: string): string {
  return [
    'Connect to this Shellui company over MCP.',
    '',
    `MCP URL: ${mcpUrl}`,
    '',
    'Add this URL as a remote MCP server and sign in with OAuth.',
    'If this client is headless or a CLI, use device login.',
    'Show the link and the code, then wait until I approve them.',
  ].join('\n');
}

function frenchAgentPrompt(mcpUrl: string): string {
  return [
    'Connectez cette entreprise Shellui en MCP.',
    '',
    `URL MCP : ${mcpUrl}`,
    '',
    'Ajoutez cette URL comme serveur MCP distant et connectez-vous avec OAuth.',
    'Si le client est sans interface ou en ligne de commande, utilisez device login.',
    'Montrez le lien et le code, puis attendez que je les approuve.',
  ].join('\n');
}

/**
 * Copy-paste prompt for an agent. `locale` selects English or French.
 * Any other value falls back to English and is not interpolated.
 */
export function buildAgentPrompt(mcpUrl: string, locale: AgentConnectPromptLocale = 'en'): string {
  const url = mcpUrl.trim();
  if (!isAbsoluteHttpUrl(url)) {
    throw new Error('Company MCP URL must be an absolute http(s) URL.');
  }
  return locale === 'fr' ? frenchAgentPrompt(url) : englishAgentPrompt(url);
}

const CREDENTIAL_MARKERS = [
  'token',
  'bearer',
  'secret',
  'password',
  'device_code',
  'user_code',
  'authorization',
  'eyj',
];

/** True when copy-paste text contains credential-shaped words. */
export function agentPromptContainsCredentialMaterial(prompt: string): boolean {
  const haystack = prompt.toLowerCase();
  return CREDENTIAL_MARKERS.some((marker) => haystack.includes(marker));
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
