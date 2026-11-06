import type {
  McpAgentActivityRow,
  McpActivityAccessKind,
  McpActivityOutcomeKind,
} from './personalAgentsApi';
import { humanizeMcpToolName } from './mcpToolActivityRegistry';

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

const MAX_SAFE_FIELD_LEN = 120;

/** http(s) URL substring detector for stripping queries from anywhere in a message */
const URL_IN_TEXT = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi;

function bodyContainsSensitiveSecret(body: string): boolean {
  const lower = body.toLowerCase();
  return SENSITIVE_SUBSTRINGS.some((needle) => lower.includes(needle));
}

/**
 * Strips query strings from http(s) URLs anywhere in the string.
 * If any secret marker appears in the full string, redacts entirely.
 */
function sanitizeUrlsAndSecretsInText(raw: string): string {
  if (!raw.trim()) return raw;
  if (bodyContainsSensitiveSecret(raw)) {
    return '[Details redacted]';
  }
  return raw.replace(URL_IN_TEXT, (url) => {
    try {
      const u = new URL(url);
      u.search = '';
      return u.toString();
    } catch {
      return url;
    }
  });
}

function truncateSafeField(text: string): string {
  if (text.length <= MAX_SAFE_FIELD_LEN) return text;
  return `${text.slice(0, MAX_SAFE_FIELD_LEN - 1)}…`;
}

/** Same pipeline for error and short result display: URLs stripped globally, secrets redact whole string. */
export function sanitizeMcpActivityErrorMessage(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const sanitized = sanitizeUrlsAndSecretsInText(raw.trim());
  if (sanitized === '[Details redacted]') return sanitized;
  return truncateSafeField(sanitized);
}

export function sanitizeActivityResultField(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  const sanitized = sanitizeUrlsAndSecretsInText(raw.trim());
  if (sanitized === '[Details redacted]') return sanitized;
  return truncateSafeField(sanitized);
}

function normalizeResultKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/** Exact `result` string -> outcome mapping only; unlisted falls back to `outcome` field parsing. */
const KNOWN_RESULT_OUTCOMES: Record<string, McpActivityOutcomeKind> = {
  ok: 'allowed',
  success: 'allowed',
  allowed: 'allowed',
  allow: 'allowed',
  allow_success: 'allowed',
  allowed_success: 'allowed',
  denied: 'denied',
  forbidden: 'denied',
  failed: 'failed',
  error: 'failed',
  pending: 'pending_approval',
  pending_approval: 'pending_approval',
  awaiting_approval: 'pending_approval',
  session: 'session_used',
  session_used: 'session_used',
  unknown: 'unknown',
};

const normOutcome = (s: string): string => normalizeResultKey(s);

export function parseActivityOutcomeFromFields(
  result: string,
  explicitOutcome: string | null | undefined,
): McpActivityOutcomeKind {
  const fromExplicit = explicitOutcome?.trim();
  if (fromExplicit) {
    const n = normOutcome(fromExplicit);
    if (n === 'allowed' || n === 'allow' || n === 'allow_success' || n === 'allowed_success')
      return 'allowed';
    if (n === 'denied' || n === 'forbidden') return 'denied';
    if (n === 'failed' || n === 'error') return 'failed';
    if (n === 'pending' || n === 'pending_approval' || n === 'awaiting_approval')
      return 'pending_approval';
    if (n === 'session_used' || n === 'session') return 'session_used';
    if (n === 'unknown') return 'unknown';
    /* Non-normalized provider strings: do not guess */
    return 'unknown';
  }

  const r = result.trim();
  if (!r) return 'unknown';
  const exact = KNOWN_RESULT_OUTCOMES[r] ?? KNOWN_RESULT_OUTCOMES[normalizeResultKey(r)];
  return exact ?? 'unknown';
}

export function inferActivityAccessKind(row: McpAgentActivityRow): McpActivityAccessKind {
  return row.accessKind ?? 'unknown';
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
  const outcome = parseActivityOutcomeFromFields(row.result, row.outcome);
  if (outcome !== 'pending_approval') return null;
  const tool = row.tool.trim();
  if (!tool) return null;
  if (pendingToolNames.has(tool)) return { type: 'tool', toolName: tool };
  return null;
}

export type ActivitySummaryLabels = {
  toolUnknown: string;
  operationSuffix: string;
};

export function buildActivityPrimarySummary(
  row: McpAgentActivityRow,
  labels: ActivitySummaryLabels,
): string {
  const title = row.operationTitle?.trim();
  if (title) {
    return title;
  }

  const rawTool = row.tool.trim();
  const service = row.service.trim() || 'service';
  const resource = row.resourceLabel?.trim();
  const company = row.companyLabel?.trim();
  const registry = rawTool ? humanizeMcpToolName(rawTool) : null;
  const op = rawTool ? `${labels.operationSuffix} ${rawTool}` : labels.operationSuffix;
  const toolLine = registry ?? (rawTool ? op : labels.toolUnknown);

  const parts: string[] = [];
  if (resource) {
    parts.push(`${service} ${resource}: ${toolLine}`);
  } else {
    parts.push(`${service}: ${toolLine}`);
  }
  if (company) parts.push(`(${company})`);
  return parts.join(' ');
}

export function formatActivityResultForDisplay(raw: string): string {
  return sanitizeActivityResultField(raw);
}
