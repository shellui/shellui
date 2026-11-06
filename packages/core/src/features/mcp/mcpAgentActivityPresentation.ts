import type {
  McpAgentActivityRow,
  McpActivityAccessKind,
  McpActivityOutcomeKind,
} from './personalAgentsApi';

export type { McpActivityAccessKind, McpActivityOutcomeKind } from './personalAgentsApi';

const SENSITIVE_SUBSTRINGS = [
  'token',
  'secret',
  'password',
  'api_key',
  'apikey',
  'bearer',
  'authorization',
  'cookie',
  'credential',
];

/** Redacts likely secrets and strips query strings from URLs; never returns raw tokens. */
export function sanitizeMcpActivityErrorMessage(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let text = raw.trim();
  if (text.length > 280) {
    text = `${text.slice(0, 277)}…`;
  }
  try {
    const u = new URL(text);
    if (u.search) {
      u.search = '';
      text = u.toString();
    }
  } catch {
    /* not a URL */
  }
  const lower = text.toLowerCase();
  for (const needle of SENSITIVE_SUBSTRINGS) {
    if (lower.includes(needle)) {
      return '[Error details redacted]';
    }
  }
  return text;
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

export function parseActivityOutcome(
  result: string,
  explicit?: string | null,
): McpActivityOutcomeKind {
  const fromExplicit = explicit?.trim().toLowerCase();
  if (fromExplicit) {
    if (fromExplicit.includes('allow')) return 'allowed';
    if (fromExplicit.includes('denied') || fromExplicit.includes('deny')) return 'denied';
    if (fromExplicit.includes('fail') || fromExplicit.includes('error')) return 'failed';
    if (fromExplicit.includes('pending') || fromExplicit.includes('approval'))
      return 'pending_approval';
    if (fromExplicit.includes('session')) return 'session_used';
  }
  const n = normalizeToken(result);
  if (!n) return 'unknown';
  if (n.includes('pending') || n.includes('await') || n.includes('approval'))
    return 'pending_approval';
  if (n.includes('deny') || n.includes('reject') || n.includes('forbidden')) return 'denied';
  if (n.includes('fail') || n.includes('error')) return 'failed';
  if (n.includes('allow') || n.includes('ok') || n.includes('success')) return 'allowed';
  if (n.includes('session')) return 'session_used';
  return 'unknown';
}

export function inferActivityAccessKind(
  row: McpAgentActivityRow,
  toolLower: string,
): McpActivityAccessKind {
  if (row.accessKind) return row.accessKind;
  const haystack = `${toolLower} ${normalizeToken(row.result)}`;
  if (/(delete|destroy|remove|revoke|drop|purge)/.test(haystack)) return 'destructive';
  if (/(write|update|set|put|post|patch|create|deploy|modify)/.test(haystack)) return 'write';
  if (/(read|get|list|fetch|describe|search)/.test(haystack)) return 'read';
  return 'unknown';
}

export function formatActivityDurationMs(
  ms: number | null | undefined,
  locale: string,
): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) {
    try {
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(ms)} ms`;
    } catch {
      return `${Math.round(ms)} ms`;
    }
  }
  const sec = ms / 1000;
  try {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: sec < 10 ? 1 : 0 }).format(sec)} s`;
  } catch {
    return `${sec.toFixed(1)} s`;
  }
}

export function formatActivityWhen(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export type ActivityPendingLink =
  | { type: 'id'; approvalId: string }
  | { type: 'tool'; toolName: string };

export function resolveActivityPendingLink(
  row: McpAgentActivityRow,
  pendingToolNames: Set<string>,
): ActivityPendingLink | null {
  if (row.approvalRequestId?.trim()) {
    return { type: 'id', approvalId: row.approvalRequestId.trim() };
  }
  const outcome = parseActivityOutcome(row.result, row.outcome);
  if (outcome !== 'pending_approval') return null;
  const tool = row.tool.trim();
  if (!tool) return null;
  if (pendingToolNames.has(tool)) return { type: 'tool', toolName: tool };
  return null;
}

export function buildActivityPrimarySummary(row: McpAgentActivityRow): string {
  const tool = row.tool.trim() || 'MCP tool';
  const service = row.service.trim() || 'service';
  const resource = row.resourceLabel?.trim();
  const company = row.companyLabel?.trim();
  const parts: string[] = [];
  if (resource) {
    parts.push(`${service} ${resource}: ${tool}`);
  } else {
    parts.push(`${service}: ${tool}`);
  }
  if (company) parts.push(`(${company})`);
  return parts.join(' ');
}
