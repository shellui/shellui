import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { MCP_ACTIVITY_ERROR_CODE_I18N_KEYS } from '../../mcp/mcpActivityErrorCodeI18n';
import { mergeMcpAgentActivity } from '../../mcp/mcpAgentActivityMerge';
import {
  activityApprovalOutcomeFallback,
  activityApprovalOutcomeLabelKey,
  activityErrorMessageForDisplay,
  activityWrapperToolForDisplay,
  buildActivityPrimarySummary,
  formatActivityDurationMs,
  formatActivityWhen,
  inferActivityAccessKind,
  parseActivityOutcomeFromFields,
  resolveActivityPendingLink,
  type ActivityPendingLink,
} from '../../mcp/mcpAgentActivityPresentation';
import {
  fetchMcpPersonalAgentActivity,
  fetchMcpPersonalAgentCallLogs,
  mcpCallLogPageHasMore,
  MCP_PERSONAL_CALL_LOG_PAGE_SIZE,
  type McpAgentActivityRow,
  type McpAgentSummary,
} from '../../mcp/personalAgentsApi';
import type { McpPendingToolApproval } from '../../mcp/mcpToolApprovalsApi';

type Props = {
  backendUrl: string;
  /** Normalized ai-service base URL from `aiService.url`. Null when unset. */
  aiServiceUrl: string | null;
  accessToken: string;
  companyId: string;
  enabled: boolean;
  agent: McpAgentSummary;
  pendingApprovals: McpPendingToolApproval[];
  onJumpToApprovals: () => void;
};

type CallLogsError = 'initial' | 'page' | null;

export const McpAgentActivitySection = ({
  backendUrl,
  aiServiceUrl,
  accessToken,
  companyId,
  enabled,
  agent,
  pendingApprovals,
  onJumpToApprovals,
}: Props) => {
  const { t, i18n } = useTranslation('settings');
  const locale = i18n.language || 'en';
  const [open, setOpen] = useState(false);
  const [identityRows, setIdentityRows] = useState<McpAgentActivityRow[]>([]);
  const [callRows, setCallRows] = useState<McpAgentActivityRow[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [identityError, setIdentityError] = useState(false);
  const [callLogsError, setCallLogsError] = useState<CallLogsError>(null);
  const requestSeq = useRef(0);

  const pendingToolNames = useMemo(
    () => new Set(pendingApprovals.map((item) => item.toolName)),
    [pendingApprovals],
  );

  const rows = useMemo(
    () =>
      mergeMcpAgentActivity(identityRows, callRows, {
        callLogsComplete: !hasMore && callLogsError !== 'page',
      }),
    [callLogsError, callRows, hasMore, identityRows],
  );

  const load = useCallback(async () => {
    const request = ++requestSeq.current;
    if (!enabled || !backendUrl || !accessToken) {
      setIdentityRows([]);
      setCallRows([]);
      setHasMore(false);
      setNextOffset(0);
      setIdentityError(false);
      setCallLogsError(null);
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    setLoading(true);
    setLoadingMore(false);
    setIdentityError(false);
    setCallLogsError(null);
    setHasMore(false);

    const consentPromise = fetchMcpPersonalAgentActivity(
      backendUrl,
      accessToken,
      companyId,
      agent.id,
    ).catch(() => {
      if (request === requestSeq.current) setIdentityError(true);
      return [] as McpAgentActivityRow[];
    });

    const callsPromise = (async () => {
      if (!aiServiceUrl) {
        if (request === requestSeq.current) setCallLogsError('initial');
        return { callLogs: [] as McpAgentActivityRow[], hasMoreCalls: false, offset: 0 };
      }
      try {
        const page = await fetchMcpPersonalAgentCallLogs(aiServiceUrl, accessToken, agent.id, {
          limit: MCP_PERSONAL_CALL_LOG_PAGE_SIZE,
          offset: 0,
        });
        return {
          callLogs: page.callLogs,
          hasMoreCalls: mcpCallLogPageHasMore(page),
          offset: page.offset + page.limit,
        };
      } catch {
        if (request === requestSeq.current) setCallLogsError('initial');
        return { callLogs: [] as McpAgentActivityRow[], hasMoreCalls: false, offset: 0 };
      }
    })();

    try {
      const [consent, calls] = await Promise.all([consentPromise, callsPromise]);
      if (request !== requestSeq.current) return;
      setIdentityRows(consent);
      setCallRows(calls.callLogs);
      setNextOffset(calls.offset);
      setHasMore(calls.hasMoreCalls);
    } finally {
      if (request === requestSeq.current) setLoading(false);
    }
  }, [accessToken, agent.id, aiServiceUrl, backendUrl, companyId, enabled]);

  const loadMore = useCallback(async () => {
    if (!enabled || !aiServiceUrl || !accessToken || loadingMore || !hasMore) return;
    const request = requestSeq.current;
    setLoadingMore(true);
    setCallLogsError(null);
    try {
      const page = await fetchMcpPersonalAgentCallLogs(aiServiceUrl, accessToken, agent.id, {
        limit: MCP_PERSONAL_CALL_LOG_PAGE_SIZE,
        offset: nextOffset,
      });
      if (request !== requestSeq.current) return;
      setCallRows((current) => [...current, ...page.callLogs]);
      setNextOffset(page.offset + page.limit);
      setHasMore(mcpCallLogPageHasMore(page));
    } catch {
      if (request === requestSeq.current) setCallLogsError('page');
    } finally {
      if (request === requestSeq.current) setLoadingMore(false);
    }
  }, [accessToken, agent.id, aiServiceUrl, enabled, hasMore, loadingMore, nextOffset]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const outcomeLabel = useCallback(
    (kind: ReturnType<typeof parseActivityOutcomeFromFields>) => {
      switch (kind) {
        case 'allowed':
          return t('mcpAgents.activity.outcome.allowed');
        case 'denied':
          return t('mcpAgents.activity.outcome.denied');
        case 'failed':
          return t('mcpAgents.activity.outcome.failed');
        case 'pending_approval':
          return t('mcpAgents.activity.outcome.pendingApproval');
        case 'session_used':
          return t('mcpAgents.activity.outcome.sessionUsed');
        default:
          return t('mcpAgents.activity.outcome.unknown');
      }
    },
    [t],
  );

  const accessLabel = useCallback(
    (row: McpAgentActivityRow) => {
      const kind = inferActivityAccessKind(row);
      switch (kind) {
        case 'read':
          return t('mcpAgents.activity.access.read');
        case 'write':
          return t('mcpAgents.activity.access.write');
        case 'destructive':
          return t('mcpAgents.activity.access.destructive');
        default:
          return t('mcpAgents.activity.access.unknown');
      }
    },
    [t],
  );

  const linkButtonLabel = useCallback(
    (link: ActivityPendingLink) => {
      if (link.type === 'id') {
        return t('mcpAgents.activity.link.openApprovalById');
      }
      return t('mcpAgents.activity.link.openApprovalsSection');
    },
    [t],
  );

  const errorCodeLabel = useCallback(
    (code: McpAgentActivityRow['errorCode']) => {
      if (!code) return null;
      return t(MCP_ACTIVITY_ERROR_CODE_I18N_KEYS[code]);
    },
    [t],
  );

  const summaryFor = useCallback(
    (row: McpAgentActivityRow) => {
      const tool = row.tool.trim();
      const titled = row.operationTitle?.trim();
      if (!titled || titled === tool) {
        if (tool.toLowerCase() === 'oauth.authorize.approved') {
          return t('mcpAgents.activity.consentOauth');
        }
        if (tool.toLowerCase() === 'oauth.device.approved') {
          return t('mcpAgents.activity.consentDevice');
        }
      }
      return buildActivityPrimarySummary(row, {
        toolUnknown: t('mcpAgents.activity.toolUnknown'),
        operationSuffix: t('mcpAgents.activity.operationSuffix'),
      });
    },
    [t],
  );

  const showFatalError = identityError && callLogsError === 'initial' && rows.length === 0;
  const showCallLogsWarning = callLogsError !== null && !showFatalError;
  const showConsentWarning = identityError && !showFatalError;
  const showEmpty = rows.length === 0 && !showCallLogsWarning && !showConsentWarning;

  return (
    <div className="mt-4 border-t pt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('mcpAgents.activity.title')}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? t('mcpAgents.activity.hide') : t('mcpAgents.activity.show')}
        </Button>
      </div>
      {open ? (
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('mcpAgents.activity.loading')}</p>
          ) : showFatalError ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('mcpAgents.activity.error')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void load()}
              >
                {t('mcpAgents.activity.retry')}
              </Button>
            </div>
          ) : (
            <>
              {showCallLogsWarning || showConsentWarning ? (
                <div className="space-y-2">
                  {showCallLogsWarning ? (
                    <p className="text-sm text-muted-foreground">
                      {callLogsError === 'page'
                        ? t('mcpAgents.activity.callLogsPageUnavailable')
                        : t('mcpAgents.activity.callLogsUnavailable')}
                    </p>
                  ) : null}
                  {showConsentWarning ? (
                    <p className="text-sm text-muted-foreground">
                      {t('mcpAgents.activity.consentUnavailable')}
                    </p>
                  ) : null}
                  {callLogsError !== 'page' || showConsentWarning ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void load()}
                    >
                      {t('mcpAgents.activity.retry')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {showEmpty ? (
                <p className="text-sm text-muted-foreground">{t('mcpAgents.activity.empty')}</p>
              ) : rows.length > 0 ? (
                <ul className="space-y-2">
                  {rows.map((row, index) => {
                    const summary = summaryFor(row);
                    const outcome = parseActivityOutcomeFromFields(row.result, row.outcome);
                    const resultDetail =
                      outcome === 'unknown'
                        ? t('mcpAgents.activity.detail.resultUnknown')
                        : outcomeLabel(outcome);
                    const errorDetailLabel = errorCodeLabel(row.errorCode);
                    const errorMessage =
                      outcome === 'failed'
                        ? activityErrorMessageForDisplay(row.errorMessage)
                        : null;
                    const wrapper = activityWrapperToolForDisplay(row.wrapperTool);
                    const approvalKey = activityApprovalOutcomeLabelKey(row.approvalOutcome);
                    const approvalLabel = approvalKey
                      ? t(approvalKey)
                      : activityApprovalOutcomeFallback(row.approvalOutcome);
                    const duration = formatActivityDurationMs(row.durationMs, locale);
                    const when = formatActivityWhen(row.timestamp, locale);
                    const access = accessLabel(row);
                    const link = resolveActivityPendingLink(row, pendingToolNames);
                    const showDestructiveBadge = row.accessKind === 'destructive';

                    return (
                      <li
                        key={`${row.timestamp}-${row.tool}-${index}`}
                        className="rounded-md border bg-muted/20 px-3 py-2 space-y-2"
                      >
                        <p className="text-sm">{summary}</p>
                        {wrapper ? (
                          <p className="text-xs text-muted-foreground">
                            {t('mcpAgents.activity.detail.viaWrapper', { wrapper })}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant="secondary"
                            className="font-normal text-xs"
                          >
                            {outcomeLabel(outcome)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="font-normal text-xs"
                          >
                            {access}
                          </Badge>
                          {showDestructiveBadge ? (
                            <Badge
                              variant="muted"
                              className="font-normal text-xs"
                            >
                              {t('mcpAgents.activity.destructiveBadge')}
                            </Badge>
                          ) : null}
                        </div>
                        <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                          <div>
                            <dt className="inline font-medium text-foreground/80">
                              {t('mcpAgents.activity.detail.when')}:{' '}
                            </dt>
                            <dd className="inline">{when}</dd>
                          </div>
                          {duration ? (
                            <div>
                              <dt className="inline font-medium text-foreground/80">
                                {t('mcpAgents.activity.detail.duration')}:{' '}
                              </dt>
                              <dd className="inline">{duration}</dd>
                            </div>
                          ) : (
                            <div>
                              <dt className="inline font-medium text-foreground/80">
                                {t('mcpAgents.activity.detail.duration')}:{' '}
                              </dt>
                              <dd className="inline">
                                {t('mcpAgents.activity.detail.notProvided')}
                              </dd>
                            </div>
                          )}
                          <div>
                            <dt className="inline font-medium text-foreground/80">
                              {t('mcpAgents.activity.detail.actor')}:{' '}
                            </dt>
                            <dd className="inline">
                              {row.actorLabel?.trim() ||
                                t('mcpAgents.activity.detail.actorUnknown')}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline font-medium text-foreground/80">
                              {t('mcpAgents.activity.detail.agent')}:{' '}
                            </dt>
                            <dd className="inline">{row.agentName?.trim() || agent.name}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="inline font-medium text-foreground/80">
                              {t('mcpAgents.activity.detail.result')}:{' '}
                            </dt>
                            <dd className="inline">{resultDetail}</dd>
                          </div>
                          {errorDetailLabel ? (
                            <div className="sm:col-span-2">
                              <dt className="inline font-medium text-foreground/80">
                                {t('mcpAgents.activity.detail.error')}:{' '}
                              </dt>
                              <dd className="inline">{errorDetailLabel}</dd>
                            </div>
                          ) : null}
                          {errorMessage ? (
                            <div className="sm:col-span-2">
                              <dt className="inline font-medium text-foreground/80">
                                {t('mcpAgents.activity.detail.errorMessage')}:{' '}
                              </dt>
                              <dd className="inline">{errorMessage}</dd>
                            </div>
                          ) : outcome === 'failed' && !errorDetailLabel ? (
                            <div className="sm:col-span-2 text-muted-foreground">
                              {t('mcpAgents.activity.detail.errorUnavailable')}
                            </div>
                          ) : null}
                          {approvalLabel ? (
                            <div className="sm:col-span-2">
                              <dt className="inline font-medium text-foreground/80">
                                {t('mcpAgents.activity.detail.approvalOutcome')}:{' '}
                              </dt>
                              <dd className="inline">{approvalLabel}</dd>
                            </div>
                          ) : null}
                        </dl>
                        {link && outcome === 'pending_approval' ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={onJumpToApprovals}
                          >
                            {linkButtonLabel(link)}
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore
                    ? t('mcpAgents.activity.loadingMore')
                    : t('mcpAgents.activity.loadMore')}
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
