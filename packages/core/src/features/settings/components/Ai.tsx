import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createDefaultAiRegistry,
  DEFAULT_OLLAMA_BASE_URL,
  probeOllama,
  probeWebGpu,
  type AiModel,
} from '@shellui/ai';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { useSettings } from '../hooks/useSettings';

type AiPanelStatus = {
  webGpu: { available: boolean; detail?: string };
  ollama: { reachable: boolean; baseUrl: string; detail?: string };
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

function StatusRow({
  label,
  ok,
  detail,
  okLabel,
  badLabel,
}: {
  label: string;
  ok: boolean;
  detail?: string;
  okLabel: string;
  badLabel: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <h3
          className="text-sm font-medium leading-none"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {label}
        </h3>
        <span className={`text-sm ${ok ? 'text-foreground' : 'text-muted-foreground'}`}>
          {ok ? okLabel : badLabel}
        </span>
      </div>
      {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function ModelList({
  title,
  empty,
  models,
  locale,
}: {
  title: string;
  empty: string;
  models: AiModel[];
  locale: string;
}) {
  return (
    <div className="space-y-2">
      <h3
        className="text-sm font-medium leading-none"
        style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
      >
        {title}
      </h3>
      {models.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {models.map((model) => {
            const size = formatBytes(model.sizeBytes, locale);
            return (
              <li
                key={model.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium">{model.name}</p>
                  {model.description ? (
                    <p className="text-muted-foreground">{model.description}</p>
                  ) : null}
                  {size ? <p className="text-muted-foreground tabular-nums">{size}</p> : null}
                </div>
                <span className="shrink-0 text-muted-foreground">{model.status}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">{t('ai.description')}</p>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h3
            className="text-sm font-medium leading-none"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('ai.enabled.title')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('ai.enabled.description')}</p>
        </div>
        <Switch
          checked={ai.enabled}
          onCheckedChange={(checked) => updateSetting('ai', { enabled: checked })}
        />
      </div>

      <div className="space-y-4">
        <h2
          className="text-base font-medium"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('ai.status.title')}
        </h2>
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
          <div className="space-y-4">
            <StatusRow
              label={t('ai.status.webGpu')}
              ok={status.webGpu.available}
              detail={status.webGpu.detail}
              okLabel={t('ai.status.available')}
              badLabel={t('ai.status.unavailable')}
            />
            <StatusRow
              label={t('ai.status.ollama')}
              ok={status.ollama.reachable}
              detail={
                status.ollama.reachable
                  ? status.ollama.baseUrl
                  : status.ollama.detail === 'disabled'
                    ? t('ai.status.ollamaDisabled')
                    : (status.ollama.detail ?? t('ai.status.ollamaOffline'))
              }
              okLabel={t('ai.status.reachable')}
              badLabel={t('ai.status.notReachable')}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
            >
              {t('ai.status.refresh')}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <h2
          className="text-base font-medium"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('ai.providers.title')}
        </h2>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('ai.providers.ollama')}</p>
            <p className="text-sm text-muted-foreground">{t('ai.providers.ollamaHint')}</p>
          </div>
          <Switch
            checked={ai.ollamaEnabled}
            onCheckedChange={(checked) => updateSetting('ai', { ollamaEnabled: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('ai.providers.browser')}</p>
            <p className="text-sm text-muted-foreground">{t('ai.providers.browserHint')}</p>
          </div>
          <Switch
            checked={ai.browserEnabled}
            onCheckedChange={(checked) => updateSetting('ai', { browserEnabled: checked })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2
          className="text-base font-medium"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('ai.defaultModel.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('ai.defaultModel.description')}</p>
        <Select
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

      <ModelList
        title={t('ai.models.ollama')}
        empty={t('ai.models.ollamaEmpty')}
        models={ollamaModels}
        locale={locale}
      />
      <ModelList
        title={t('ai.models.browser')}
        empty={t('ai.models.browserEmpty')}
        models={browserModels}
        locale={locale}
      />

      <p className="text-sm text-muted-foreground">{t('ai.footnote')}</p>
    </div>
  );
};
