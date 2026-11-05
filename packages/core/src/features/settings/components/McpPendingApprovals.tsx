import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  decideMcpToolApproval,
  fetchMcpPendingToolApprovals,
  getMcpSettingsCompanyDisplayName,
  mcpApprovalExpiresInMinutes,
  type McpPendingToolApproval,
} from '../../mcp/mcpToolApprovalsApi';
import { useConfig } from '../../config/useConfig';

const PENDING_POLL_MS = 5_000;

type Props = {
  backendUrl: string;
  accessToken: string;
  companyId: string;
  enabled: boolean;
};

export const McpPendingApprovals = ({ backendUrl, accessToken, companyId, enabled }: Props) => {
  const { t } = useTranslation('settings');
  const { config } = useConfig();
  const companyName = getMcpSettingsCompanyDisplayName(config);

  const [approvals, setApprovals] = useState<McpPendingToolApproval[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const loadPending = useCallback(async () => {
    if (!enabled || !backendUrl || !accessToken) {
      setApprovals([]);
      setPendingCount(0);
      return;
    }
    try {
      const list = await fetchMcpPendingToolApprovals(backendUrl, accessToken, companyId);
      if (!mountedRef.current) return;
      const live = list.approvals.filter((row) => mcpApprovalExpiresInMinutes(row.expiresAt) > 0);
      setApprovals(live);
      setPendingCount(list.pendingCount > 0 ? list.pendingCount : live.length);
    } catch {
      if (!mountedRef.current) return;
      setApprovals([]);
      setPendingCount(0);
    }
  }, [accessToken, backendUrl, companyId, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadPending();
    if (!enabled) return undefined;
    const timer = window.setInterval(() => {
      void loadPending();
    }, PENDING_POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, loadPending]);

  const runDecide = useCallback(
    async (approval: McpPendingToolApproval, decision: 'approve' | 'deny') => {
      setDecidingId(approval.id);
      try {
        await decideMcpToolApproval(backendUrl, accessToken, companyId, approval.id, decision);
        shellui.toast({
          type: 'success',
          title:
            decision === 'approve'
              ? t('mcpAgents.pendingApprovals.toast.approvedTitle')
              : t('mcpAgents.pendingApprovals.toast.deniedTitle'),
          description: t('mcpAgents.pendingApprovals.toast.description', {
            toolName: approval.toolName,
          }),
        });
        await loadPending();
      } catch {
        shellui.toast({
          type: 'error',
          title: t('mcpAgents.pendingApprovals.toast.errorTitle'),
        });
      } finally {
        setDecidingId(null);
      }
    },
    [accessToken, backendUrl, companyId, loadPending, t],
  );

  const handleApprove = useCallback(
    (approval: McpPendingToolApproval) => {
      if (approval.isDestructive) {
        shellui.dialog({
          title: t('mcpAgents.pendingApprovals.confirmApprove.title', {
            toolName: approval.toolName,
          }),
          description: t('mcpAgents.pendingApprovals.confirmApprove.description', {
            companyName,
          }),
          mode: 'okCancel',
          size: 'sm',
          okLabel: t('mcpAgents.pendingApprovals.confirmApprove.confirm'),
          cancelLabel: t('mcpAgents.pendingApprovals.confirmApprove.cancel'),
          onOk: async () => {
            await runDecide(approval, 'approve');
          },
          onCancel: () => {},
        });
        return;
      }
      void runDecide(approval, 'approve');
    },
    [companyName, runDecide, t],
  );

  if (pendingCount <= 0 || approvals.length === 0) {
    return null;
  }

  const countLabel = String(pendingCount);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          className="text-sm font-medium leading-none"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('mcpAgents.pendingApprovals.title')}
        </h2>
        <Badge
          variant="muted"
          className="font-normal tabular-nums"
        >
          {countLabel}
        </Badge>
      </div>
      <ul className="space-y-3">
        {approvals.map((approval) => {
          const expiresInMinutes = mcpApprovalExpiresInMinutes(approval.expiresAt);
          const busy = decidingId === approval.id;
          return (
            <li
              key={approval.id}
              className="rounded-lg border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium font-mono">{approval.toolName}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('mcpAgents.pendingApprovals.meta', {
                      agentName: approval.agentName,
                      expiresInMinutes,
                    })}
                  </p>
                  {approval.shortActionSummary ? (
                    <p className="text-sm text-muted-foreground">{approval.shortActionSummary}</p>
                  ) : null}
                  {approval.isDestructive ? (
                    <Badge
                      variant="muted"
                      className="mt-1 font-normal"
                    >
                      {t('mcpAgents.pendingApprovals.destructiveBadge')}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => handleApprove(approval)}
                  >
                    {t('mcpAgents.pendingApprovals.approve')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void runDecide(approval, 'deny')}
                  >
                    {t('mcpAgents.pendingApprovals.deny')}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
