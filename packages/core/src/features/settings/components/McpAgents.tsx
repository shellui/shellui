import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  createMcpPersonalAgent,
  fetchMcpPersonalAgentActivity,
  fetchMcpPersonalAgents,
  getMcpPersonalCompanyId,
  getShellIdentityBackendUrl,
  MCP_PERSONAL_SERVICE_OPTIONS,
  revokeMcpPersonalAgent,
  type CreatePersonalAgentResult,
  type McpAccessMode,
  type McpAgentActivityRow,
  type McpAgentSummary,
  type McpPersonalService,
  type McpReadLevel,
} from '../../mcp/personalAgentsApi';
import { useConfig } from '../../config/useConfig';
import { RefreshCwIcon } from '../SettingsIcons';
import { useMcpPersonalStatus } from '../hooks/useMcpPersonalStatus';

type IssuedToken = {
  accessToken: string;
  expiresAt: string;
  resource: string;
};

const defaultServiceSelection = (): Record<McpPersonalService, boolean> => ({
  identity: true,
  storage: false,
  hosting: false,
  email: false,
  saas: false,
});

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDatetimeLocal(value: string): Date | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function formatTimestamp(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const CopyField = ({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (label: string, value: string) => void;
}) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
    <code className="flex-1 break-all rounded-md border bg-muted px-3 py-2 text-xs">{value}</code>
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={() => onCopy(label, value)}
    >
      {label}
    </Button>
  </div>
);

export const McpAgents = () => {
  const { t, i18n } = useTranslation('settings');
  const locale = i18n.language || 'en';
  const { config } = useConfig();
  const { session, isAuthenticated } = useAuth();
  const accessToken = session?.accessToken ?? null;
  const backendUrl = getShellIdentityBackendUrl(config);
  const companyId = getMcpPersonalCompanyId(config);

  const {
    status,
    loading: statusLoading,
    error: statusError,
    refresh: refreshStatus,
  } = useMcpPersonalStatus(config, accessToken, isAuthenticated);

  const [agents, setAgents] = useState<McpAgentSummary[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState(false);

  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [activityByAgent, setActivityByAgent] = useState<
    Record<string, { loading: boolean; error: boolean; rows: McpAgentActivityRow[] }>
  >({});
  const [lastActivityAt, setLastActivityAt] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [services, setServices] = useState(defaultServiceSelection);
  const [accessMode, setAccessMode] = useState<McpAccessMode>('ask');
  const [readLevel, setReadLevel] = useState<McpReadLevel>('safe');
  const [allowDestructive, setAllowDestructive] = useState(false);
  const [expiresLocal, setExpiresLocal] = useState(() =>
    toDatetimeLocalValue(new Date(Date.now() + 7 * 86400000)),
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<IssuedToken | null>(null);

  const selectedServices = useMemo(
    () => MCP_PERSONAL_SERVICE_OPTIONS.filter((service) => services[service]),
    [services],
  );

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
      void Promise.allSettled(
        list.map(async (agent) => {
          const rows = await fetchMcpPersonalAgentActivity(
            backendUrl,
            accessToken,
            companyId,
            agent.id,
          );
          const latest = rows[0]?.timestamp;
          if (latest) {
            setLastActivityAt((prev) => ({ ...prev, [agent.id]: latest }));
          }
        }),
      );
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

  const loadActivity = useCallback(
    async (agentId: string) => {
      if (!backendUrl || !accessToken) return;
      setActivityByAgent((prev) => ({
        ...prev,
        [agentId]: { loading: true, error: false, rows: prev[agentId]?.rows ?? [] },
      }));
      try {
        const rows = await fetchMcpPersonalAgentActivity(
          backendUrl,
          accessToken,
          companyId,
          agentId,
        );
        setActivityByAgent((prev) => ({
          ...prev,
          [agentId]: { loading: false, error: false, rows },
        }));
      } catch {
        setActivityByAgent((prev) => ({
          ...prev,
          [agentId]: { loading: false, error: true, rows: [] },
        }));
      }
    },
    [accessToken, backendUrl, companyId],
  );

  const toggleActivity = useCallback(
    (agentId: string) => {
      setExpandedActivityId((current) => {
        const next = current === agentId ? null : agentId;
        if (next && !activityByAgent[agentId]?.rows.length && !activityByAgent[agentId]?.loading) {
          void loadActivity(agentId);
        }
        return next;
      });
    },
    [activityByAgent, loadActivity],
  );

  const handleRevoke = useCallback(
    (agent: McpAgentSummary) => {
      shellui.dialog({
        title: t('mcpAgents.revoke.title'),
        description: t('mcpAgents.revoke.description', { name: agent.name }),
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
    if (!trimmedName || selectedServices.length === 0) return;
    const expiresAtDate = parseDatetimeLocal(expiresLocal);
    if (!expiresAtDate || expiresAtDate.getTime() <= Date.now()) {
      setCreateError(t('mcpAgents.create.expiryInvalid'));
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
          name: trimmedName,
          services: selectedServices,
          accessMode,
          readLevel,
          allowDestructive,
          expiresAt: expiresAtDate.toISOString(),
        },
      );
      setIssuedToken({
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
        resource: result.resource,
      });
      setName('');
      setServices(defaultServiceSelection());
      setAllowDestructive(false);
      await loadAgents();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('mcpAgents.create.errorGeneric');
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }, [
    accessMode,
    accessToken,
    allowDestructive,
    backendUrl,
    companyId,
    expiresLocal,
    loadAgents,
    name,
    readLevel,
    selectedServices,
    t,
  ]);

  const agentStatusLabel = useCallback(
    (agent: McpAgentSummary) => {
      if (agent.revokedAt) return t('mcpAgents.agents.status.revoked');
      if (agent.pausedAt) return t('mcpAgents.agents.status.paused');
      if (agent.expiresAt && new Date(agent.expiresAt).getTime() <= Date.now()) {
        return t('mcpAgents.agents.status.expired');
      }
      if (agent.isActive) return t('mcpAgents.agents.status.active');
      return t('mcpAgents.agents.status.inactive');
    },
    [t],
  );

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

  const mcpUrl = status.mcpUrl ?? '';

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{t('mcpAgents.description')}</p>
      </div>

      <section className="rounded-lg border bg-card p-4 space-y-4">
        <div className="space-y-1">
          <h2
            className="text-sm font-medium leading-none"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('mcpAgents.gateway.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('mcpAgents.gateway.enabledHint')}</p>
        </div>
        {mcpUrl ? (
          <CopyField
            label={t('mcpAgents.gateway.copyUrl')}
            value={mcpUrl}
            onCopy={copyValue}
          />
        ) : null}
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t('mcpAgents.gateway.setupTitle')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('mcpAgents.gateway.hints.chatgpt')}</li>
            <li>{t('mcpAgents.gateway.hints.claude')}</li>
            <li>{t('mcpAgents.gateway.hints.cursor')}</li>
            <li>{t('mcpAgents.gateway.hints.other')}</li>
          </ul>
        </div>
      </section>

      {issuedToken ? (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
          <div className="space-y-1">
            <h2
              className="text-sm font-medium leading-none text-amber-900 dark:text-amber-100"
              style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
            >
              {t('mcpAgents.tokenReveal.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('mcpAgents.tokenReveal.warning')}</p>
          </div>
          <CopyField
            label={t('mcpAgents.tokenReveal.copyToken')}
            value={issuedToken.accessToken}
            onCopy={copyValue}
          />
          <p className="text-sm text-muted-foreground">
            {t('mcpAgents.tokenReveal.expires', {
              date: formatTimestamp(issuedToken.expiresAt, locale),
            })}
          </p>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{t('mcpAgents.tokenReveal.usageTitle')}</p>
            <p className="text-muted-foreground">{t('mcpAgents.tokenReveal.usageBody')}</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {`Authorization: Bearer ${t('mcpAgents.tokenReveal.tokenPlaceholder')}\nPOST ${issuedToken.resource}`}
            </pre>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIssuedToken(null)}
          >
            {t('mcpAgents.tokenReveal.dismiss')}
          </Button>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <h2
              className="text-sm font-medium leading-none"
              style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
            >
              {t('mcpAgents.agents.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('mcpAgents.agents.description')}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('mcpAgents.agents.refresh')}
            onClick={() => void loadAgents()}
          >
            <RefreshCwIcon />
          </Button>
        </div>

        {agentsLoading ? (
          <p className="text-sm text-muted-foreground">{t('mcpAgents.agents.loading')}</p>
        ) : agentsError ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('mcpAgents.agents.error')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadAgents()}
            >
              {t('mcpAgents.agents.retry')}
            </Button>
          </div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('mcpAgents.agents.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {agents.map((agent) => {
              const activityState = activityByAgent[agent.id];
              const lastActivity =
                activityState?.rows[0]?.timestamp ?? lastActivityAt[agent.id] ?? null;
              const expanded = expandedActivityId === agent.id;
              return (
                <li
                  key={agent.id}
                  className="rounded-lg border bg-card p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium truncate">{agent.name}</h3>
                        <Badge variant="secondary">
                          {agent.kind === 'oauth'
                            ? t('mcpAgents.agents.kind.oauth')
                            : t('mcpAgents.agents.kind.personal')}
                        </Badge>
                        <Badge variant={agent.isActive && !agent.revokedAt ? 'default' : 'outline'}>
                          {agentStatusLabel(agent)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('mcpAgents.agents.rightsSummary', {
                          access: t(`mcpAgents.accessMode.${agent.accessMode}`),
                          read: t(`mcpAgents.readLevel.${agent.readLevel}`),
                          destructive: agent.allowDestructiveWithoutAsking
                            ? t('mcpAgents.agents.destructiveOn')
                            : t('mcpAgents.agents.destructiveOff'),
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('mcpAgents.agents.services', {
                          list: agent.servicesAllowed.join(', '),
                        })}
                      </p>
                      {agent.expiresAt ? (
                        <p className="text-xs text-muted-foreground">
                          {t('mcpAgents.agents.expires', {
                            date: formatTimestamp(agent.expiresAt, locale),
                          })}
                        </p>
                      ) : null}
                      {lastActivity ? (
                        <p className="text-xs text-muted-foreground">
                          {t('mcpAgents.agents.lastActivity', {
                            date: formatTimestamp(lastActivity, locale),
                          })}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActivity(agent.id)}
                      >
                        {expanded ? t('mcpAgents.activity.hide') : t('mcpAgents.activity.show')}
                      </Button>
                      {agent.isActive && !agent.revokedAt ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevoke(agent)}
                        >
                          {t('mcpAgents.revoke.action')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {expanded ? (
                    <div className="border-t pt-3 space-y-2">
                      {activityState?.loading ? (
                        <p className="text-sm text-muted-foreground">
                          {t('mcpAgents.activity.loading')}
                        </p>
                      ) : activityState?.error ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {t('mcpAgents.activity.error')}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void loadActivity(agent.id)}
                          >
                            {t('mcpAgents.activity.retry')}
                          </Button>
                        </div>
                      ) : activityState?.rows.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="pb-2 pr-3 font-medium">
                                  {t('mcpAgents.activity.columns.time')}
                                </th>
                                <th className="pb-2 pr-3 font-medium">
                                  {t('mcpAgents.activity.columns.tool')}
                                </th>
                                <th className="pb-2 pr-3 font-medium">
                                  {t('mcpAgents.activity.columns.service')}
                                </th>
                                <th className="pb-2 pr-3 font-medium">
                                  {t('mcpAgents.activity.columns.result')}
                                </th>
                                <th className="pb-2 font-medium">
                                  {t('mcpAgents.activity.columns.clientIp')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {activityState.rows.map((row, index) => (
                                <tr
                                  key={`${row.timestamp}-${index}`}
                                  className="border-t border-border/60"
                                >
                                  <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                                    {formatTimestamp(row.timestamp, locale)}
                                  </td>
                                  <td className="py-2 pr-3">{row.tool}</td>
                                  <td className="py-2 pr-3">{row.service}</td>
                                  <td className="py-2 pr-3">{row.result}</td>
                                  <td className="py-2">{row.clientIp ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t('mcpAgents.activity.empty')}
                        </p>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4 space-y-4">
        <div className="space-y-1">
          <h2
            className="text-sm font-medium leading-none"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('mcpAgents.create.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('mcpAgents.create.description')}</p>
        </div>

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
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('mcpAgents.create.servicesLabel')}</legend>
          <p className="text-sm text-muted-foreground">{t('mcpAgents.create.servicesHint')}</p>
          <div className="flex flex-col gap-2">
            {MCP_PERSONAL_SERVICE_OPTIONS.map((service) => (
              <label
                key={service}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border border-input"
                  checked={services[service]}
                  onChange={(event) =>
                    setServices((prev) => ({ ...prev, [service]: event.target.checked }))
                  }
                />
                {t(`mcpAgents.services.${service}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="mcp-access-mode"
            >
              {t('mcpAgents.create.accessModeLabel')}
            </label>
            <Select
              id="mcp-access-mode"
              value={accessMode}
              onChange={(event) => setAccessMode(event.target.value as McpAccessMode)}
            >
              <option value="read_only">{t('mcpAgents.accessMode.read_only')}</option>
              <option value="ask">{t('mcpAgents.accessMode.ask')}</option>
              <option value="full">{t('mcpAgents.accessMode.full')}</option>
            </Select>
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="mcp-read-level"
            >
              {t('mcpAgents.create.readLevelLabel')}
            </label>
            <Select
              id="mcp-read-level"
              value={readLevel}
              onChange={(event) => setReadLevel(event.target.value as McpReadLevel)}
            >
              <option value="safe">{t('mcpAgents.readLevel.safe')}</option>
              <option value="sensitive">{t('mcpAgents.readLevel.sensitive')}</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('mcpAgents.create.destructiveLabel')}</p>
            <p className="text-sm text-muted-foreground">{t('mcpAgents.create.destructiveHint')}</p>
          </div>
          <Switch
            checked={allowDestructive}
            onCheckedChange={setAllowDestructive}
            aria-label={t('mcpAgents.create.destructiveLabel')}
          />
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium"
            htmlFor="mcp-expires"
          >
            {t('mcpAgents.create.expiresLabel')}
          </label>
          <Input
            id="mcp-expires"
            type="datetime-local"
            value={expiresLocal}
            onChange={(event) => setExpiresLocal(event.target.value)}
          />
        </div>

        {createError ? <p className="text-sm text-destructive">{createError}</p> : null}

        <Button
          type="button"
          disabled={creating || !name.trim() || selectedServices.length === 0}
          onClick={() => void handleCreate()}
        >
          {creating ? t('mcpAgents.create.submitting') : t('mcpAgents.create.submit')}
        </Button>
      </section>
    </div>
  );
};
