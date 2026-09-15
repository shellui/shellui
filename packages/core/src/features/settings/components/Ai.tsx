import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { cn } from '../../../lib/utils';
import { createDefaultAiRegistry } from '../../ai/createRegistry';
import { DEFAULT_OLLAMA_BASE_URL, probeOllama, probeWebGpu } from '../../ai/status';
import type { AiModel } from '../../ai/types';
import { ChevronDownIcon } from '../SettingsIcons';
import { useSettings } from '../hooks/useSettings';

type AiPanelStatus = {
  webGpu: { available: boolean; detail?: string };
  ollama: { reachable: boolean; baseUrl: string; detail?: string; latencyMs?: number };
  models: AiModel[];
};

function formatBytes(bytes: number | undefined, locale: string): string | null {
  if (bytes === undefined || !Number.isFinite(bytes)) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        'mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full',
        ok ? 'bg-emerald-500' : 'bg-muted-foreground/40',
      )}
      aria-hidden
    />
  );
}

function ModelRows({
  models,
  locale,
  empty,
}: {
  models: AiModel[];
  locale: string;
  empty: string;
}) {
  if (models.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-border/60 rounded-md border border-border/60">
      {models.map((model) => {
        const size = formatBytes(model.sizeBytes, locale);
        return (
          <li
            key={model.id}
            className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="truncate font-medium">{model.name}</p>
              {model.description ? (
                <p className="text-muted-foreground">{model.description}</p>
              ) : null}
            </div>
            <div className="shrink-0 space-y-0.5 text-right text-muted-foreground">
              <p className="capitalize">{model.status}</p>
              {size ? <p className="tabular-nums text-xs">{size}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export const Ai = () => {
  const { t, i18n } = useTranslation('settings');
  const { settings, updateSetting } = useSettings();
  const locale = i18n.language || 'en';
  const ai = settings.ai ?? {
    enabled: true,
    defaultModelId: null,
    ollamaEnabled: true,
    browserEnabled: true,
  };

  const [status, setStatus] = useState<AiPanelStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const registry = createDefaultAiRegistry({
        ollama: { baseUrl: ai.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL },
        includeWebLLM: ai.browserEnabled,
      });
      const [webGpu, ollama, models] = await Promise.all([
        probeWebGpu(),
        ai.ollamaEnabled
          ? probeOllama({ baseUrl: ai.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL })
          : Promise.resolve({
              reachable: false,
              baseUrl: ai.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL,
              detail: 'disabled',
            }),
        registry.listModels(),
      ]);
      const filtered = models.filter((model) => {
        if (model.provider === 'ollama') return ai.ollamaEnabled;
        if (model.provider === 'webllm') return ai.browserEnabled;
        return true;
      });
      setStatus({ webGpu, ollama, models: filtered });
    } catch {
      setStatus(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [ai.browserEnabled, ai.ollamaBaseUrl, ai.ollamaEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const readyModels = (status?.models ?? []).filter((m) => m.status === 'ready');
  const ollamaModels = (status?.models ?? []).filter((m) => m.provider === 'ollama');
  const browserModels = (status?.models ?? []).filter((m) => m.provider === 'webllm');

  const ollamaPlainDetail =
    status == null
      ? null
      : status.ollama.reachable
        ? status.ollama.baseUrl
        : status.ollama.detail === 'disabled'
          ? t('ai.status.ollamaDisabled')
          : (status.ollama.detail ?? t('ai.status.ollamaOffline'));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('ai.description')}</p>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <label
            htmlFor="ai-enabled"
            className="text-sm font-medium leading-none"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('ai.enabled.title')}
          </label>
          <p className="text-sm text-muted-foreground">{t('ai.enabled.description')}</p>
        </div>
        <Switch
          id="ai-enabled"
          checked={ai.enabled}
          onCheckedChange={(checked) => updateSetting('ai', { enabled: checked })}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label
            className="text-sm font-medium leading-none"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('ai.status.title')}
          </label>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={loading}
            onClick={() => void load()}
          >
            {t('ai.status.refresh')}
          </Button>
        </div>

        {loading && !status ? (
          <p className="text-sm text-muted-foreground">{t('ai.status.loading')}</p>
        ) : null}

        {error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{t('ai.status.error')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
            >
              {t('ai.status.retry')}
            </Button>
          </div>
        ) : null}

        {status ? (
          <div className="rounded-md border border-border/50 bg-muted/40 px-3 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <StatusDot ok={status.webGpu.available} />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium leading-none">{t('ai.status.webGpu')}</p>
                  <p className="text-sm text-muted-foreground">
                    {status.webGpu.available
                      ? t('ai.status.available')
                      : t('ai.status.unavailable')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <StatusDot ok={status.ollama.reachable} />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium leading-none">{t('ai.status.ollama')}</p>
                  <p className="text-sm text-muted-foreground">
                    {status.ollama.reachable ? t('ai.status.connected') : t('ai.status.offline')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="ai-default-model"
          className="text-sm font-medium leading-none"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('ai.defaultModel.title')}
        </label>
        <p className="text-sm text-muted-foreground">{t('ai.defaultModel.description')}</p>
        <Select
          id="ai-default-model"
          value={ai.defaultModelId ?? ''}
          disabled={readyModels.length === 0}
          onChange={(event) =>
            updateSetting('ai', {
              defaultModelId: event.target.value || null,
            })
          }
        >
          <option value="">{t('ai.defaultModel.none')}</option>
          {readyModels.map((model) => (
            <option
              key={model.id}
              value={model.id}
            >
              {model.name} ({model.provider})
            </option>
          ))}
        </Select>
        {readyModels.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('ai.defaultModel.empty')}</p>
        ) : null}
      </div>

      <div className="space-y-4">
        <label
          className="text-sm font-medium leading-none"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('ai.providers.title')}
        </label>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p
                className="text-sm font-medium leading-none"
                style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
              >
                {t('ai.providers.ollama')}
              </p>
              <p className="text-sm text-muted-foreground">{t('ai.providers.ollamaHint')}</p>
            </div>
            <Switch
              checked={ai.ollamaEnabled}
              onCheckedChange={(checked) => updateSetting('ai', { ollamaEnabled: checked })}
            />
          </div>
          {ai.ollamaEnabled ? (
            <ModelRows
              models={ollamaModels}
              locale={locale}
              empty={t('ai.models.ollamaEmpty')}
            />
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p
                className="text-sm font-medium leading-none"
                style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
              >
                {t('ai.providers.browser')}
              </p>
              <p className="text-sm text-muted-foreground">{t('ai.providers.browserHint')}</p>
            </div>
            <Switch
              checked={ai.browserEnabled}
              onCheckedChange={(checked) => updateSetting('ai', { browserEnabled: checked })}
            />
          </div>
          {ai.browserEnabled ? (
            <ModelRows
              models={browserModels}
              locale={locale}
              empty={t('ai.models.browserEmpty')}
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-md border border-border/60">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <span
            className="text-sm font-medium"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('ai.details.title')}
          </span>
          <ChevronDownIcon
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              detailsOpen && 'rotate-180',
            )}
          />
        </button>
        {detailsOpen ? (
          <div className="space-y-2 border-t border-border/60 px-3 py-3 text-sm text-muted-foreground">
            <p>{t('ai.footnote')}</p>
            {status?.webGpu.detail ? (
              <p>
                {t('ai.details.webGpuDetail')}: {status.webGpu.detail}
              </p>
            ) : null}
            {ollamaPlainDetail ? (
              <p>
                {t('ai.details.ollamaDetail')}: {ollamaPlainDetail}
                {status?.ollama.latencyMs != null ? ` (${status.ollama.latencyMs} ms)` : null}
              </p>
            ) : null}
            {!status?.webGpu.detail && !ollamaPlainDetail ? <p>{t('ai.details.empty')}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
