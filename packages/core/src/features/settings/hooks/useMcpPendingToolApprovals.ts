import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchMcpPendingToolApprovals,
  mcpApprovalExpiresInMinutes,
  type McpPendingToolApproval,
} from '../../mcp/mcpToolApprovalsApi';

const PENDING_POLL_MS = 5_000;

export type McpPendingApprovalsState = {
  approvals: McpPendingToolApproval[];
  pendingCount: number;
  refresh: () => Promise<void>;
};

export function useMcpPendingToolApprovals(
  backendUrl: string,
  accessToken: string,
  companyId: string,
  enabled: boolean,
): McpPendingApprovalsState {
  const [approvals, setApprovals] = useState<McpPendingToolApproval[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
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

  return useMemo(
    () => ({
      approvals,
      pendingCount,
      refresh: loadPending,
    }),
    [approvals, pendingCount, loadPending],
  );
}
