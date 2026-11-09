import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  agentIncludesSaasScope,
  buildAgentPrompt,
  buildCompanyMcpUrl,
  MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS,
  defaultPersonalAgentExpiresAt,
  formatAgentExpiry,
  formatConnectionDate,
  formatDefaultAgentName,
  getDefaultPersonalAgentServices,
  isActiveMcpConnection,
  isGlobalIdentitySession,
} from '../../mcp/mcpAgentsConnect';
import {
  createMcpPersonalAgent,
  fetchMcpPersonalAgents,
  getMcpPersonalCompanyId,
  getShellIdentityBackendUrl,
  revokeMcpPersonalAgent,
  type CreatePersonalAgentResult,
  type McpAgentSummary,
} from '../../mcp/personalAgentsApi';
import { getMcpSettingsCompanyDisplayName } from '../../mcp/mcpToolApprovalsApi';
import { useConfig } from '../../config/useConfig';
import { getNormalizedAiServiceUrl } from '../utils/buildSettingsForPropagation';
import { useMcpPersonalStatus } from '../hooks/useMcpPersonalStatus';
import { useMcpPendingToolApprovals } from '../hooks/useMcpPendingToolApprovals';
import { McpAgentActivitySection } from './McpAgentActivitySection';
import { McpPendingApprovals } from './McpPendingApprovals';

type IssuedConnection = {
  accessToken: string;
  mcpUrl: string;
  prompt: string;
};

export const McpAgents = () => {
  const { t, i18n } = useTranslation('settings');
  const locale = i18n.language || 'en';
  const { config } = useConfig();
  const { session, isAuthenticated, user } = useAuth();
  const accessToken = session?.accessToken ?? null;
  const backendUrl = getShellIdentityBackendUrl(config);
  const companyId = getMcpPersonalCompanyId(config);
  const aiServiceUrl = getNormalizedAiServiceUrl(config?.aiService);

  const {
    status,
    loading: statusLoading,
    error: statusError,
    refresh: refreshStatus,
  } = useMcpPersonalStatus(config, accessToken, isAuthenticated, user?.id ?? null);

  const includeSaas = isGlobalIdentitySession(status);
  const companyDisplayName = getMcpSettingsCompanyDisplayName(config);
  const pendingEnabled = Boolean(backendUrl && accessToken && status?.mcpEnabled);
  const {
    approvals: pendingApprovals,
    pendingCount: pendingCountState,
    refresh: refreshPending,
  } = useMcpPendingToolApprovals(backendUrl ?? '', accessToken ?? '', companyId, pendingEnabled);
  const pendingSectionRef = useRef<HTMLElement | null>(null);

  const scrollToPendingApprovals = useCallback(() => {
    pendingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const globalMcpDisplayUrl = useMemo(() => {
    const u = status?.globalMcpUrl?.trim() ?? '';
    return u || null;
  }, [status?.globalMcpUrl]);

  const companyMcpUrl = useMemo(
    () => buildCompanyMcpUrl(aiServiceUrl, companyId, status?.mcpUrl),
    [aiServiceUrl, companyId, status?.mcpUrl],
  );

  const [agents, setAgents] = useState<McpAgentSummary[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [issuedConnection, setIssuedConnection] = useState<IssuedConnection | null>(null);

  const copyValue = useCallback(
    async (label: string, value: string) => {
      if (!navigator?.clipboard?.writeText) {
        shellui.toast({
          type: 'error',
          title: t('mcpAgents.clipboard.copyFailedTitle'),
          description: t('mcpAgents.clipboard.unavailable'),
        });
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        shellui.toast({
          type: 'success',
          title: t('mcpAgents.clipboard.copiedTitle'),
          description: t('mcpAgents.clipboard.copiedDescription', { label }),
        });
      } catch {
        shellui.toast({
          type: 'error',
          title: t('mcpAgents.clipboard.copyFailedTitle'),
          description: t('mcpAgents.clipboard.failed'),
        });
      }
    },
    [t],
  );

  const loadAgents = useCallback(async () => {
    if (!backendUrl || !accessToken || !status?.mcpEnabled) {
      setAgents([]);
      return;
    }
    setAgentsLoading(true);
    setAgentsError(false);
    try {
      const list = await fetchMcpPersonalAgents(backendUrl, accessToken, companyId);
      setAgents(list);
    } catch {
      setAgents([]);
      setAgentsError(true);
    } finally {
      setAgentsLoading(false);
    }
  }, [accessToken, backendUrl, companyId, status?.mcpEnabled]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const activeAgents = useMemo(
    () => agents.filter((agent) => isActiveMcpConnection(agent)),
    [agents],
  );

  const revokedAgents = useMemo(() => agents.filter((agent) => Boolean(agent.revokedAt)), [agents]);

  const scopeLabel = useCallback(
    (agent: McpAgentSummary) =>
      agentIncludesSaasScope(agent)
        ? t('mcpAgents.connections.scopeRegionalSaas')
        : t('mcpAgents.connections.scopeRegional'),
    [t],
  );

  const handleRevoke = useCallback(
    (agent: McpAgentSummary) => {
      shellui.dialog({
        title: t('mcpAgents.revoke.title'),
        description: t('mcpAgents.revoke.description'),
        mode: 'delete',
        size: 'sm',
        okLabel: t('mcpAgents.revoke.confirm'),
        cancelLabel: t('mcpAgents.revoke.cancel'),
        onOk: async () => {
          if (!backendUrl || !accessToken) return;
          try {
            await revokeMcpPersonalAgent(backendUrl, accessToken, companyId, agent.id);
            shellui.toast({
              type: 'success',
              title: t('mcpAgents.revoke.successTitle'),
              description: t('mcpAgents.revoke.successDescription', { name: agent.name }),
            });
            await loadAgents();
          } catch {
            shellui.toast({
              type: 'error',
              title: t('mcpAgents.revoke.errorTitle'),
            });
          }
        },
        onCancel: () => {},
      });
    },
    [accessToken, backendUrl, companyId, loadAgents, t],
  );

  const handleCreate = useCallback(async () => {
    if (!backendUrl || !accessToken) return;
    const trimmedName = name.trim();
    const resolvedName = trimmedName || formatDefaultAgentName(locale);
    const mcpUrl = companyMcpUrl;
    if (!mcpUrl) {
      setCreateError(t('mcpAgents.create.errorMissingMcpUrl'));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const result: CreatePersonalAgentResult = await createMcpPersonalAgent(
        backendUrl,
        accessToken,
        companyId,
        {
          name: resolvedName,
          services: getDefaultPersonalAgentServices(includeSaas),
          accessMode: 'ask',
          readLevel: 'safe',
          allowDestructive: false,
          expiresAt: defaultPersonalAgentExpiresAt(),
        },
        { allowSaas: includeSaas },
      );
      const promptMcpUrl = buildCompanyMcpUrl(aiServiceUrl, companyId, result.resource) ?? mcpUrl;
      const prompt = buildAgentPrompt(promptMcpUrl, result.accessToken);
      setIssuedConnection({
        accessToken: result.accessToken,
        mcpUrl: promptMcpUrl,
        prompt,
      });
      setCreateOpen(false);
      setName('');
      await loadAgents();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const message = raw.includes('exceeds the maximum allowed lifetime')
        ? t('mcpAgents.create.errorExpiryTooLong')
        : raw || t('mcpAgents.create.errorGeneric');
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }, [
    accessToken,
    aiServiceUrl,
    backendUrl,
    companyId,
    companyMcpUrl,
    includeSaas,
    loadAgents,
    locale,
    name,
    t,
  ]);

  if (!isAuthenticated) {
    return <p className="text-sm text-muted-foreground">{t('mcpAgents.signInRequired')}</p>;
  }

  if (statusLoading) {
    return <p className="text-sm text-muted-foreground">{t('mcpAgents.status.loading')}</p>;
  }

  if (statusError || !status?.mcpEnabled) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {statusError ? t('mcpAgents.status.error') : t('mcpAgents.status.unavailable')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshStatus}
        >
          {t('mcpAgents.status.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <p className="text-sm text-muted-foreground">{t('mcpAgents.description')}</p>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <h2
          className="text-sm font-medium leading-none"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('mcpAgents.global.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('mcpAgents.global.intro')}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t('mcpAgents.global.scopeAccount')}</li>
          <li>{t('mcpAgents.global.scopeRegional')}</li>
          <li>{t('mcpAgents.global.sessions')}</li>
          <li>{t('mcpAgents.global.approvals')}</li>
        </ul>
        <p className="text-sm text-muted-foreground">{t('mcpAgents.global.prerequisite')}</p>
        {globalMcpDisplayUrl ? (
          <p className="text-sm text-muted-foreground">
            {t('mcpAgents.global.globalMcpUrlLabel')}{' '}
            <span
              className="select-none font-mono text-xs text-muted-foreground/80"
              translate="no"
            >
              {globalMcpDisplayUrl}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('mcpAgents.global.globalMcpUrlUnknown')}
          </p>
        )}
        {includeSaas ? (
          <p className="text-sm text-foreground">{t('mcpAgents.global.statusReady')}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t('mcpAgents.global.statusPending')}</p>
        )}
      </section>

      {issuedConnection ? (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-4">
          <div className="space-y-1">
            <h2
              className="text-sm font-medium leading-none text-amber-900 dark:text-amber-100"
              style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
            >
              {t('mcpAgents.success.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('mcpAgents.success.warning')}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('mcpAgents.success.promptLabel')}</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted px-3 py-2 text-xs">
              {issuedConnection.prompt}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void copyValue(t('mcpAgents.success.copyPrompt'), issuedConnection.prompt)
                }
              >
                {t('mcpAgents.success.copyPrompt')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void copyValue(t('mcpAgents.success.copyTokenOnly'), issuedConnection.accessToken)
                }
              >
                {t('mcpAgents.success.copyTokenOnly')}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <McpPendingApprovals
        ref={pendingSectionRef}
        backendUrl={backendUrl ?? ''}
        accessToken={accessToken ?? ''}
        companyId={companyId}
        enabled={Boolean(backendUrl && accessToken && status?.mcpEnabled)}
        companyName={companyDisplayName}
        approvals={pendingApprovals}
        pendingCount={pendingCountState}
        onRefresh={refreshPending}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            className="text-sm font-medium leading-none"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('mcpAgents.connections.title')}
          </h2>
          <Button
            type="button"
            size="sm"
            disabled={createOpen}
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            {t('mcpAgents.connections.connect')}
          </Button>
        </div>

        {createOpen && !issuedConnection ? (
          <section className="rounded-lg border bg-card p-4 space-y-4">
            <h3
              className="text-sm font-medium leading-none"
              style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
            >
              {t('mcpAgents.create.title')}
            </h3>
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="mcp-agent-name"
              >
                {t('mcpAgents.create.nameLabel')}
              </label>
              <Input
                id="mcp-agent-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('mcpAgents.create.namePlaceholder')}
              />
              <p className="text-sm text-muted-foreground">{t('mcpAgents.create.nameHelper')}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {includeSaas
                ? t('mcpAgents.create.accessHelperGlobal')
                : t('mcpAgents.create.accessHelperRegional')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('mcpAgents.create.expiryHelper', { days: MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS })}
            </p>
            {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={creating}
                onClick={() => void handleCreate()}
              >
                {creating ? t('mcpAgents.create.submitting') : t('mcpAgents.create.submit')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={creating}
                onClick={() => {
                  setCreateOpen(false);
                  setCreateError(null);
                  setName('');
                }}
              >
                {t('mcpAgents.create.cancel')}
              </Button>
            </div>
          </section>
        ) : null}

        {agentsLoading ? (
          <p className="text-sm text-muted-foreground">{t('mcpAgents.connections.loading')}</p>
        ) : agentsError ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('mcpAgents.connections.error')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadAgents()}
            >
              {t('mcpAgents.connections.retry')}
            </Button>
          </div>
        ) : activeAgents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('mcpAgents.connections.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {activeAgents.map((agent) => {
              const connectedDate = formatConnectionDate(agent.createdAt, locale);
              const expiryLabel = formatAgentExpiry(agent.expiresAt, locale);
              return (
                <li
                  key={agent.id}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-medium">
                        {expiryLabel
                          ? t('mcpAgents.connections.connectedMetaWithExpiry', {
                              name: agent.name,
                              date: connectedDate,
                              expiry: expiryLabel,
                            })
                          : t('mcpAgents.connections.connectedMeta', {
                              name: agent.name,
                              date: connectedDate,
                            })}
                      </p>
                      <p className="text-sm text-muted-foreground">{scopeLabel(agent)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleRevoke(agent)}
                    >
                      {t('mcpAgents.revoke.action')}
                    </Button>
                  </div>
                  <McpAgentActivitySection
                    backendUrl={backendUrl ?? ''}
                    accessToken={accessToken ?? ''}
                    companyId={companyId}
                    enabled={Boolean(backendUrl && accessToken && status?.mcpEnabled)}
                    agent={agent}
                    pendingApprovals={pendingApprovals}
                    onJumpToApprovals={scrollToPendingApprovals}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {revokedAgents.length > 0 ? (
          <div className="space-y-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-0 text-muted-foreground"
              onClick={() => setShowRevoked((value) => !value)}
            >
              {showRevoked
                ? t('mcpAgents.connections.hideRevoked')
                : t('mcpAgents.connections.showRevoked')}
            </Button>
            {showRevoked ? (
              <ul className="space-y-3">
                {revokedAgents.map((agent) => (
                  <li
                    key={agent.id}
                    className="rounded-lg border border-dashed bg-muted/30 p-4"
                  >
                    <p className="text-sm text-muted-foreground">
                      {t('mcpAgents.connections.revokedMeta', {
                        name: agent.name,
                        date: formatConnectionDate(agent.revokedAt ?? agent.createdAt, locale),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
};
