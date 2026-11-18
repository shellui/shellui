import type {
  McpAgentActivityRow,
  McpActivityAccessKind,
  McpActivityOutcomeKind,
} from './personalAgentsApi';
import { humanizeMcpToolName } from './mcpToolActivityRegistry';

export type { McpActivityAccessKind, McpActivityOutcomeKind } from './personalAgentsApi';

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
  waiting_approval: 'pending_approval',
  session: 'session_used',
  session_used: 'session_used',
  unknown: 'unknown',
};

export function parseActivityOutcomeFromFields(
  result: string,
  explicitOutcome: McpActivityOutcomeKind | null | undefined,
): McpActivityOutcomeKind {
  if (explicitOutcome !== null && explicitOutcome !== undefined) {
    return explicitOutcome;
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

const APPROVAL_OUTCOME_LABEL_KEYS: Record<string, string> = {
  pending: 'mcpAgents.activity.detail.approvalOutcomeValue.pending',
  denied: 'mcpAgents.activity.detail.approvalOutcomeValue.denied',
  accepted: 'mcpAgents.activity.detail.approvalOutcomeValue.accepted',
  session_used: 'mcpAgents.activity.detail.approvalOutcomeValue.sessionUsed',
  expired: 'mcpAgents.activity.detail.approvalOutcomeValue.expired',
  failed: 'mcpAgents.activity.detail.approvalOutcomeValue.failed',
};

const SAFE_TOKEN = /^[a-z0-9_]{1,32}$/;
const SAFE_WRAPPER_TOOL = /^[A-Za-z0-9_.-]{1,64}$/;

/** Translated label key for a known approval outcome. Unknown tokens return null. */
export function activityApprovalOutcomeLabelKey(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const token = normalizeResultKey(value);
  if (!SAFE_TOKEN.test(token)) return null;
  return APPROVAL_OUTCOME_LABEL_KEYS[token] ?? null;
}

/** Safe raw token when the outcome has no translated label. */
export function activityApprovalOutcomeFallback(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const token = normalizeResultKey(value);
  if (!SAFE_TOKEN.test(token) || APPROVAL_OUTCOME_LABEL_KEYS[token]) return null;
  return token;
}

/** Wrapper name safe to show after "via". */
export function activityWrapperToolForDisplay(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  if (!SAFE_WRAPPER_TOOL.test(text)) return null;
  return text;
}

/** Single-line redacted error text. Control characters are stripped. */
export function activityErrorMessageForDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.slice(0, 500);
}

export function isRecognizedActivityResultToken(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const r = raw.trim();
  return (
    Object.prototype.hasOwnProperty.call(KNOWN_RESULT_OUTCOMES, r) ||
    Object.prototype.hasOwnProperty.call(KNOWN_RESULT_OUTCOMES, normalizeResultKey(r))
  );
}

/**
 * Returns a display token only for recognized provider result codes. Never returns arbitrary text.
 */
export function formatActivityResultForDisplay(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (!isRecognizedActivityResultToken(trimmed)) return null;
  return KNOWN_RESULT_OUTCOMES[trimmed] !== undefined ? trimmed : normalizeResultKey(trimmed);
}
