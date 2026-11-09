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
  isAbsoluteHttpUrl,
  isActiveMcpConnection,
  isGlobalIdentitySession,
  resolveAgentConnectPromptLocale,
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

type IssuedSecret = {
  accessToken: string;
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
  const absoluteMcpUrl = useMemo(
    () => (companyMcpUrl && isAbsoluteHttpUrl(companyMcpUrl) ? companyMcpUrl : null),
    [companyMcpUrl],
  );
  const connectPrompt = useMemo(
    () =>
      absoluteMcpUrl
        ? buildAgentPrompt(absoluteMcpUrl, resolveAgentConnectPromptLocale(locale))
        : null,
    [absoluteMcpUrl, locale],
  );

  const [agents, setAgents] = useState<McpAgentSummary[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [issuedSecret, setIssuedSecret] = useState<IssuedSecret | null>(null);
  const staticDetailsRef = useRef<HTMLDetailsElement>(null);

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

  const loadAgents = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!backendUrl || !accessToken || !status?.mcpEnabled) {
        setAgents([]);
        return;
      }
      if (!options?.silent) {
        setAgentsLoading(true);
        setAgentsError(false);
      }
      try {
        const list = await fetchMcpPersonalAgents(backendUrl, accessToken, companyId);
        setAgents(list);
        setAgentsError(false);
      } catch {
        if (!options?.silent) {
          setAgents([]);
          setAgentsError(true);
        }
      } finally {
        if (!options?.silent) {
          setAgentsLoading(false);
        }
      }
    },
    [accessToken, backendUrl, companyId, status?.mcpEnabled],
  );

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'hidden') return;
      void loadAgents({ silent: true });
    };
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
    };
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

  const kindLabel = useCallback(
    (agent: McpAgentSummary) =>
      agent.kind === 'oauth'
        ? t('mcpAgents.connections.kindOauth')
        : t('mcpAgents.connections.kindPersonal'),
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
    if (!absoluteMcpUrl) {
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
      setIssuedSecret({ accessToken: result.accessToken });
      if (staticDetailsRef.current) {
        staticDetailsRef.current.open = true;
      }
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
    absoluteMcpUrl,
    accessToken,
    backendUrl,
    companyId,
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

      <section className="rounded-lg border bg-card p-4 space-y-4">
        <h2
          className="text-sm font-medium leading-none"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('mcpAgents.connect.title')}
        </h2>
        {connectPrompt && absoluteMcpUrl ? (
          <>
            <p className="text-sm text-muted-foreground">{t('mcpAgents.connect.intro')}</p>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('mcpAgents.connect.urlLabel')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <code
                  className="min-w-0 break-all font-mono text-xs"
                  translate="no"
                >
                  {absoluteMcpUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyValue(t('mcpAgents.connect.copyUrl'), absoluteMcpUrl)}
                >
                  {t('mcpAgents.connect.copyUrl')}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('mcpAgents.connect.promptLabel')}</p>
              <pre
                className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted px-3 py-2 text-xs"
                translate="no"
                children={connectPrompt}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyValue(t('mcpAgents.connect.copyPrompt'), connectPrompt)}
              >
                {t('mcpAgents.connect.copyPrompt')}
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('mcpAgents.connect.stepsLead')}</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>{t('mcpAgents.connect.steps.paste')}</li>
                <li>{t('mcpAgents.connect.steps.openLink')}</li>
                <li>{t('mcpAgents.connect.steps.allow')}</li>
              </ol>
            </div>
            <details
              ref={staticDetailsRef}
              className="rounded-md border bg-background"
            >
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                {t('mcpAgents.staticSecret.summary')}
              </summary>
              <div className="space-y-4 px-3 pb-3">
                <p className="text-sm text-muted-foreground">
                  {t('mcpAgents.staticSecret.helper')}
                </p>
                <p className="text-sm text-muted-foreground">{t('mcpAgents.staticSecret.once')}</p>
                {issuedSecret ? (
                  <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                    <p className="text-sm font-medium">{t('mcpAgents.success.title')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('mcpAgents.success.warning')}
                    </p>
                    <pre
                      className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted px-3 py-2 text-xs"
                      translate="no"
                      children={issuedSecret.accessToken}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void copyValue(
                            t('mcpAgents.success.copySecret'),
                            issuedSecret.accessToken,
                          )
                        }
                      >
                        {t('mcpAgents.success.copySecret')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIssuedSecret(null)}
                      >
                        {t('mcpAgents.success.hide')}
                      </Button>
                    </div>
                  </div>
                ) : null}
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
                  <p className="text-sm text-muted-foreground">
                    {t('mcpAgents.create.nameHelper')}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {includeSaas
                    ? t('mcpAgents.create.accessHelperGlobal')
                    : t('mcpAgents.create.accessHelperRegional')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('mcpAgents.create.expiryHelper', {
                    days: MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS,
                  })}
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
                      setCreateError(null);
                      setName('');
                      if (staticDetailsRef.current) {
                        staticDetailsRef.current.open = false;
                      }
                    }}
                  >
                    {t('mcpAgents.create.cancel')}
                  </Button>
                </div>
              </div>
            </details>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('mcpAgents.create.errorMissingMcpUrl')}
          </p>
        )}
      </section>

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
        <h2
          className="text-sm font-medium leading-none"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('mcpAgents.connections.title')}
        </h2>

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
                      <p className="text-sm text-muted-foreground">{kindLabel(agent)}</p>
                      {agent.kind === 'oauth' && agent.servicesAllowed.length > 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t('mcpAgents.connections.services', {
                            services: agent.servicesAllowed.join(', '),
                          })}
                        </p>
                      ) : agent.kind === 'personal' ? (
                        <p className="text-sm text-muted-foreground">{scopeLabel(agent)}</p>
                      ) : null}
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
                    <p className="text-sm text-muted-foreground">{kindLabel(agent)}</p>
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
