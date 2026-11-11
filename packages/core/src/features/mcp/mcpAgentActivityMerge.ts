import type { McpAgentActivityRow } from './personalAgentsApi';

/**
 * Identity still writes these consent rows. Tool calls moved to ai-service,
 * so other activity rows from identity are older call logs and are dropped.
 */
const OAUTH_CONSENT_TOOLS = new Set(['oauth.authorize.approved', 'oauth.device.approved']);

export function isMcpOAuthConsentActivityRow(row: Pick<McpAgentActivityRow, 'tool'>): boolean {
  return OAUTH_CONSENT_TOOLS.has(row.tool.trim().toLowerCase());
}

function timestampMs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Merge OAuth consent rows with ai-service call logs, newest first.
 * While a later call-log page is still unloaded, consent older than the
 * oldest loaded call stays out so it does not jump ahead of that page.
 */
export function mergeMcpAgentActivity(
  identityRows: McpAgentActivityRow[],
  callLogs: McpAgentActivityRow[],
  options?: { callLogsComplete?: boolean },
): McpAgentActivityRow[] {
  const consent = identityRows.filter(isMcpOAuthConsentActivityRow);
  const complete = options?.callLogsComplete !== false;
  let visibleConsent = consent;
  if (!complete && callLogs.length > 0) {
    let oldest = Number.POSITIVE_INFINITY;
    for (const row of callLogs) {
      const ms = timestampMs(row.timestamp);
      if (ms !== null && ms < oldest) oldest = ms;
    }
    if (Number.isFinite(oldest)) {
      visibleConsent = consent.filter((row) => {
        const ms = timestampMs(row.timestamp);
        return ms !== null && ms >= oldest;
      });
    }
  }

  return [...visibleConsent, ...callLogs].sort((a, b) => {
    const am = timestampMs(a.timestamp);
    const bm = timestampMs(b.timestamp);
    if (am === null && bm === null) return 0;
    if (am === null) return 1;
    if (bm === null) return -1;
    return bm - am;
  });
}
