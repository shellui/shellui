import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  buildActivityPrimarySummary,
  formatActivityDurationMs,
  formatActivityWhen,
  inferActivityAccessKind,
  parseActivityOutcomeFromFields,
  resolveActivityPendingLink,
  sanitizeMcpActivityErrorMessage,
  type ActivityPendingLink,
} from '../../mcp/mcpAgentActivityPresentation';
import {
  fetchMcpPersonalAgentActivity,
  type McpAgentActivityRow,
  type McpAgentSummary,
} from '../../mcp/personalAgentsApi';
import type { McpPendingToolApproval } from '../../mcp/mcpToolApprovalsApi';

type Props = {
  backendUrl: string;
  accessToken: string;
  companyId: string;
  enabled: boolean;
  agent: McpAgentSummary;
  pendingApprovals: McpPendingToolApproval[];
  onJumpToApprovals: () => void;
};

export const McpAgentActivitySection = ({
  backendUrl,
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
  const [rows, setRows] = useState<McpAgentActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const pendingToolNames = useMemo(
    () => new Set(pendingApprovals.map((a) => a.toolName)),
    [pendingApprovals],
  );

  const load = useCallback(async () => {
    if (!enabled || !backendUrl || !accessToken) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const list = await fetchMcpPersonalAgentActivity(
        backendUrl,
        accessToken,
        companyId,
        agent.id,
      );
      setRows(list);
    } catch {
      setRows([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, agent.id, backendUrl, companyId, enabled]);

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
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? t('mcpAgents.activity.hide') : t('mcpAgents.activity.show')}
        </Button>
      </div>
      {open ? (
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('mcpAgents.activity.loading')}</p>
          ) : error ? (
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
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('mcpAgents.activity.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row, index) => {
                const summary = buildActivityPrimarySummary(row, {
                  toolUnknown: t('mcpAgents.activity.toolUnknown'),
                  operationSuffix: t('mcpAgents.activity.operationSuffix'),
                });
                const outcome = parseActivityOutcomeFromFields(row.result, row.outcome);
                const resultDetail =
                  outcome === 'unknown'
                    ? t('mcpAgents.activity.detail.resultUnknown')
                    : outcomeLabel(outcome);
                const safeError = sanitizeMcpActivityErrorMessage(row.errorMessage);
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
                          <dd className="inline">{t('mcpAgents.activity.detail.notProvided')}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="inline font-medium text-foreground/80">
                          {t('mcpAgents.activity.detail.actor')}:{' '}
                        </dt>
                        <dd className="inline">
                          {row.actorLabel?.trim() || t('mcpAgents.activity.detail.actorUnknown')}
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
                      {safeError ? (
                        <div className="sm:col-span-2">
                          <dt className="inline font-medium text-foreground/80">
                            {t('mcpAgents.activity.detail.error')}:{' '}
                          </dt>
                          <dd className="inline">{safeError}</dd>
                        </div>
                      ) : outcome === 'failed' ? (
                        <div className="sm:col-span-2 text-muted-foreground">
                          {t('mcpAgents.activity.detail.errorUnavailable')}
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
          )}
        </div>
      ) : null}
    </div>
  );
};
