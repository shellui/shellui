import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { cn } from '../../../lib/utils';
import { isBrowserModelInstalled } from '../../ai/browserInstallStore';
import { BROWSER_MODEL_CATALOG } from '../../ai/catalog';
import { createDefaultAiRegistry, getSharedWebLLMAdapter } from '../../ai/createRegistry';
import { DEFAULT_OLLAMA_BASE_URL, probeOllama, probeWebGpu } from '../../ai/status';
import type { AiModel } from '../../ai/types';
import { formatUnknownError, logAiError } from '../../ai/engine/formatAiError';
import { probeWebLlmBrowserSupport } from '../../ai/webLlmBrowserSupport';
import { RefreshCwIcon } from '../SettingsIcons';
import { useSettings } from '../hooks/useSettings';

const BROWSER_MODEL_LOCAL_IDS = BROWSER_MODEL_CATALOG.map((model) =>
  model.id.replace(/^webllm:/, ''),
);

type AiPanelStatus = {
  webGpu: { available: boolean; detail?: string };
  ollama: { reachable: boolean; baseUrl: string; detail?: string; latencyMs?: number };
  storage: { available: boolean; detail?: string };
  models: AiModel[];
};

type DownloadState = {
  modelId: string;
  progress: number;
  error?: string;
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

async function probeBrowserStorage(): Promise<{ available: boolean; detail?: string }> {
  const storage = (
    globalThis as {
      navigator?: { storage?: { estimate?: () => Promise<{ quota?: number; usage?: number }> } };
    }
  ).navigator?.storage;
  if (!storage?.estimate) {
    return { available: false, detail: 'Browser storage estimate is unavailable.' };
  }
  try {
    const estimate = await storage.estimate();
    const quota = estimate.quota ?? 0;
    if (quota <= 0) {
      return { available: false, detail: 'No durable storage quota reported.' };
    }
    return {
      available: true,
      detail: `${formatBytes(estimate.usage ?? 0, 'en') ?? '0 B'} / ${formatBytes(quota, 'en')}`,
    };
  } catch (error) {
    return {
      available: false,
      detail: error instanceof Error ? error.message : 'Storage probe failed.',
    };
  }
}

function StatusBadge({
  ok,
  okLabel,
  badLabel,
}: {
  ok: boolean;
  okLabel: string;
  badLabel: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        ok
          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {ok ? okLabel : badLabel}
    </span>
  );
}

function ModelStatusBadge({
  status,
  t,
}: {
  status: AiModel['status'];
  t: (key: string) => string;
}) {
  const label =
    status === 'ready'
      ? t('ai.models.status.ready')
      : status === 'downloadable'
        ? t('ai.models.status.downloadable')
        : status === 'downloading'
          ? t('ai.models.status.downloading')
          : status === 'needs-webgpu'
            ? t('ai.models.status.needsWebGpu')
            : status === 'unsupported'
              ? t('ai.models.status.unsupported')
              : t('ai.models.status.unavailable');
  const tone =
    status === 'ready'
      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
      : status === 'downloading'
        ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
        : status === 'unsupported'
          ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
          : 'bg-muted text-muted-foreground';
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', tone)}>
      {label}
    </span>
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

  const webllm = useMemo(() => getSharedWebLLMAdapter(), []);
  const [status, setStatus] = useState<AiPanelStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [download, setDownload] = useState<DownloadState | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const registry = createDefaultAiRegistry({
        ollama: { baseUrl: ai.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL },
        includeWebLLM: ai.browserEnabled,
        webllmAdapter: webllm,
        defaultModelId: ai.defaultModelId,
      });
      const [webGpu, ollama, storage, models] = await Promise.all([
        probeWebGpu(),
        ai.ollamaEnabled
          ? probeOllama({ baseUrl: ai.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL })
          : Promise.resolve({
              reachable: false,
              baseUrl: ai.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL,
              detail: 'disabled',
            }),
        probeBrowserStorage(),
        registry.listModels(),
      ]);
      const filtered = models.filter((model) => {
        if (model.provider === 'ollama') return ai.ollamaEnabled;
        if (model.provider === 'webllm') return ai.browserEnabled;
        return true;
      });
      setStatus({ webGpu, ollama, storage, models: filtered });
    } catch {
      setStatus(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [ai.browserEnabled, ai.ollamaBaseUrl, ai.ollamaEnabled, ai.defaultModelId, webllm]);

  // Keep in-panel progress in sync when Settings remounts mid-download (toaster owns the job).
  useEffect(() => {
    if (!ai.enabled) return;
    const engine = webllm.getEngine();
    const syncFromEngine = () => {
      for (const localId of BROWSER_MODEL_LOCAL_IDS) {
        const progress = engine.getDownloadProgress(localId);
        if (progress !== null) {
          setDownload({ modelId: `webllm:${localId}`, progress });
          return;
        }
      }
    };
    syncFromEngine();
    return engine.subscribeProgress((localId, progress) => {
      setDownload({ modelId: `webllm:${localId}`, progress });
      if (progress >= 1) {
        setDownload(null);
        void load();
      }
    });
  }, [ai.enabled, load, webllm]);

  useEffect(() => {
    if (!ai.enabled) {
      setStatus(null);
      setError(false);
      setLoading(false);
      setDownload(null);
      return;
    }
    void load();
  }, [ai.enabled, load]);

  useEffect(() => {
    if (ai.defaultModelId || !status) return;
    const ready = status.models.filter((model) => model.status === 'ready');
    if (ready.length === 1) {
      updateSetting('ai', { defaultModelId: ready[0].id });
    }
  }, [ai.defaultModelId, status, updateSetting]);

  const readyModels = (status?.models ?? []).filter((m) => m.status === 'ready');
  const ollamaModels = (status?.models ?? []).filter((m) => m.provider === 'ollama');
  const browserModels = (status?.models ?? []).filter((m) => m.provider === 'webllm');

  const startDownload = async (model: AiModel) => {
    // Non-Chromium browsers are experimental, not blocked: attempt Install and let
    // the real error surface (mapped) rather than pre-emptively refusing.
    setDownload({ modelId: model.id, progress: 0 });
    const controller = new AbortController();
    downloadAbortRef.current = controller;
    try {
      await webllm.download(model.id, {
        signal: controller.signal,
        onProgress: (progress) => setDownload({ modelId: model.id, progress }),
      });
      setDownload(null);
      await load();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setDownload(null);
        await load();
        return;
      }
      logAiError('settings.install', err, { modelId: model.id, stage: 'settings.startDownload' });
      setDownload({
        modelId: model.id,
        progress: 0,
        error: formatUnknownError(err) || t('ai.unknownError'),
      });
      await load();
    } finally {
      downloadAbortRef.current = null;
    }
  };

  const cancelDownload = (modelId: string) => {
    webllm.cancelDownload(modelId);
    downloadAbortRef.current?.abort();
    setDownload(null);
  };

  const deleteModel = async (modelId: string) => {
    await webllm.deleteInstalled(modelId);
    if (ai.defaultModelId === modelId) {
      updateSetting('ai', { defaultModelId: null });
    }
    await load();
  };

  return (
    <div className="space-y-5">
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

      <div
        data-shellui-ai-details={ai.enabled ? 'open' : 'closed'}
        aria-hidden={!ai.enabled}
      >
        <div
          data-shellui-ai-details-inner
          className="space-y-5"
          inert={!ai.enabled ? true : undefined}
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2
                className="text-sm font-medium leading-none"
                style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
              >
                {t('ai.status.title')}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={loading}
                onClick={() => void load()}
                aria-label={t('ai.status.refresh')}
              >
                <RefreshCwIcon />
                {t('ai.status.refresh')}
              </Button>
            </div>

            {loading && !status ? (
              <p className="text-sm text-muted-foreground">{t('ai.status.loading')}</p>
            ) : null}
            {error ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    {
                      key: 'webGpu',
                      title: t('ai.status.webGpu'),
                      hint: t('ai.status.webGpuHint'),
                      ok: status.webGpu.available,
                      okLabel: t('ai.status.available'),
                      badLabel: t('ai.status.unavailable'),
                    },
                    {
                      key: 'ollama',
                      title: t('ai.status.ollama'),
                      hint: status.ollama.reachable
                        ? t('ai.status.ollamaOnlineHint')
                        : t('ai.status.ollamaOffline'),
                      ok: status.ollama.reachable,
                      okLabel: t('ai.status.connected'),
                      badLabel: t('ai.status.offline'),
                    },
                    {
                      key: 'storage',
                      title: t('ai.status.storage'),
                      hint: t('ai.status.storageHint'),
                      ok: status.storage.available,
                      okLabel: t('ai.status.available'),
                      badLabel: t('ai.status.unavailable'),
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.key}
                    className="rounded-lg border border-border/60 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.hint}</p>
                      </div>
                      <StatusBadge
                        ok={item.ok}
                        okLabel={item.okLabel}
                        badLabel={item.badLabel}
                      />
                    </div>
                  </div>
                ))}
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

          <div className="space-y-3">
            <h2
              className="text-sm font-medium leading-none"
              style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
            >
              {t('ai.providers.title')}
            </h2>

            <section className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="ai-ollama-enabled"
                    className="text-sm font-medium leading-none"
                    style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
                  >
                    {t('ai.providers.ollama')}
                  </label>
                  <p className="text-sm text-muted-foreground">{t('ai.providers.ollamaHint')}</p>
                </div>
                <Switch
                  id="ai-ollama-enabled"
                  checked={ai.ollamaEnabled}
                  onCheckedChange={(checked) => updateSetting('ai', { ollamaEnabled: checked })}
                />
              </div>
              {ai.ollamaEnabled ? (
                ollamaModels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {status?.ollama.reachable
                      ? t('ai.models.ollamaEmptyReady')
                      : t('ai.models.ollamaEmpty')}
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
                    {ollamaModels.map((model) => (
                      <li
                        key={model.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <p className="min-w-0 truncate text-sm font-medium">{model.name}</p>
                        <div className="flex items-center gap-2">
                          {formatBytes(model.sizeBytes, locale) ? (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {formatBytes(model.sizeBytes, locale)}
                            </span>
                          ) : null}
                          <ModelStatusBadge
                            status={model.status}
                            t={t}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </section>

            <section className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="ai-browser-enabled"
                    className="text-sm font-medium leading-none"
                    style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
                  >
                    {t('ai.providers.browser')}
                  </label>
                  <p className="text-sm text-muted-foreground">{t('ai.providers.browserHint')}</p>
                </div>
                <Switch
                  id="ai-browser-enabled"
                  checked={ai.browserEnabled}
                  onCheckedChange={(checked) => updateSetting('ai', { browserEnabled: checked })}
                />
              </div>
              {ai.browserEnabled && status && !status.webGpu.available ? (
                <p className="text-xs text-muted-foreground">{t('ai.models.needsWebGpuAction')}</p>
              ) : null}
              {ai.browserEnabled && !probeWebLlmBrowserSupport().recommended ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-900 dark:text-amber-100">
                  {t('ai.models.experimentalBrowser')}
                </p>
              ) : null}
              {ai.browserEnabled ? (
                browserModels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('ai.models.browserEmpty')}</p>
                ) : (
                  <ul className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
                    {browserModels.map((model) => {
                      const size = formatBytes(model.sizeBytes, locale);
                      const isDownloading = download?.modelId === model.id;
                      const progress = isDownloading
                        ? download.progress
                        : (webllm.getDownloadProgress(model.id) ?? null);
                      const installed = isBrowserModelInstalled(model.id);
                      const canDownload =
                        !installed &&
                        model.status !== 'downloading' &&
                        model.status !== 'needs-webgpu';
                      return (
                        <li
                          key={model.id}
                          className="space-y-2 px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{model.name}</p>
                              {size ? (
                                <p className="text-xs tabular-nums text-muted-foreground">{size}</p>
                              ) : null}
                            </div>
                            <ModelStatusBadge
                              status={isDownloading ? 'downloading' : model.status}
                              t={t}
                            />
                          </div>

                          {isDownloading || typeof progress === 'number' ? (
                            <div className="space-y-2">
                              <div
                                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round((progress ?? 0) * 100)}
                                aria-label={t('ai.models.downloadProgress', {
                                  percent: Math.round((progress ?? 0) * 100),
                                })}
                              >
                                <div
                                  className="h-full rounded-full bg-primary transition-[width]"
                                  style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">
                                  {t('ai.models.downloadProgress', {
                                    percent: Math.round((progress ?? 0) * 100),
                                  })}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => cancelDownload(model.id)}
                                >
                                  {t('ai.models.cancel')}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {canDownload ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={!status?.webGpu.available}
                                  onClick={() => void startDownload(model)}
                                >
                                  {t('ai.models.download')}
                                </Button>
                              ) : null}
                              {installed ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-destructive"
                                  onClick={() => void deleteModel(model.id)}
                                >
                                  {t('ai.models.delete')}
                                </Button>
                              ) : null}
                            </div>
                          )}
                          {download?.modelId === model.id && download.error ? (
                            <p className="text-xs text-destructive">{download.error}</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
