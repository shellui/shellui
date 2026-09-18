import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import {
  estimateInstalledCatalogBytes,
  listBrowserInstalledIds,
} from '../../ai/browserInstallStore';
import { BROWSER_MODEL_CATALOG } from '../../ai/catalog';
import { useAuth } from '../../auth/hooks/useAuth';
import { isAiFeatureEnabled } from '../../ai/isAiFeatureEnabled';
import { useConfig } from '../../config/useConfig';
import {
  fetchStorageQuota,
  formatBytes,
  getStorageBaseUrl,
  getUsagePercent,
  isStorageSettingsEnabled,
  type StorageQuotaBucket,
  type StorageQuotaSnapshot,
} from '../../storage/quota';
import { useSettings } from '../hooks/useSettings';

type OriginStorageEstimate = {
  usageBytes: number;
  quotaBytes: number | null;
};

const QuotaMeter = ({
  label,
  description,
  bucket,
}: {
  label: string;
  description?: string;
  bucket: StorageQuotaBucket;
}) => {
  const { t, i18n } = useTranslation('settings');
  const locale = i18n.language || 'en';
  const percent = getUsagePercent(bucket.usedBytes, bucket.maxBytes);
  const used = formatBytes(bucket.usedBytes, locale);
  const max = bucket.maxBytes !== null ? formatBytes(bucket.maxBytes, locale) : null;
  const barTone = percent !== null && percent >= 100 ? 'bg-destructive' : 'bg-primary';

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <h3
          className="text-sm font-medium leading-none"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {label}
        </h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <p className="text-sm tabular-nums">
        {max ? t('storage.usedOfMax', { used, max }) : t('storage.usedOnly', { used })}
      </p>
      {percent !== null ? (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-label={label}
        >
          <div
            className={`h-full rounded-full transition-[width] ${barTone}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
};

async function readOriginStorageEstimate(): Promise<OriginStorageEstimate | null> {
  const storage = (
    globalThis as {
      navigator?: { storage?: { estimate?: () => Promise<{ quota?: number; usage?: number }> } };
    }
  ).navigator?.storage;
  if (!storage?.estimate) return null;
  try {
    const estimate = await storage.estimate();
    const usageBytes =
      typeof estimate.usage === 'number' && Number.isFinite(estimate.usage) ? estimate.usage : 0;
    const quotaBytes =
      typeof estimate.quota === 'number' && Number.isFinite(estimate.quota) && estimate.quota > 0
        ? estimate.quota
        : null;
    return { usageBytes, quotaBytes };
  } catch {
    return null;
  }
}

const LocalAiModelsUsage = () => {
  const { t, i18n } = useTranslation('settings');
  const locale = i18n.language || 'en';
  const [origin, setOrigin] = useState<OriginStorageEstimate | null | undefined>(undefined);
  const installedCount = listBrowserInstalledIds().length;
  const catalogBytes = estimateInstalledCatalogBytes(BROWSER_MODEL_CATALOG);

  useEffect(() => {
    let cancelled = false;
    void readOriginStorageEstimate().then((value) => {
      if (!cancelled) setOrigin(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const originBucket: StorageQuotaBucket | null =
    origin === undefined
      ? null
      : origin
        ? {
            usedBytes: origin.usageBytes,
            maxBytes: origin.quotaBytes,
            remainingBytes:
              origin.quotaBytes !== null
                ? Math.max(0, origin.quotaBytes - origin.usageBytes)
                : null,
          }
        : null;

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <h2
          className="text-sm font-medium leading-none"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('storage.aiModels.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('storage.aiModels.description')}</p>
      </div>

      {origin === undefined ? (
        <p className="text-sm text-muted-foreground">{t('storage.aiModels.loading')}</p>
      ) : null}

      {originBucket ? (
        <QuotaMeter
          label={t('storage.aiModels.originUsage')}
          description={t('storage.aiModels.originHint')}
          bucket={originBucket}
        />
      ) : origin === null ? (
        <p className="text-sm text-muted-foreground">{t('storage.aiModels.estimateUnavailable')}</p>
      ) : null}

      <div className="space-y-2">
        <div className="space-y-0.5">
          <h3
            className="text-sm font-medium leading-none"
            style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
          >
            {t('storage.aiModels.catalogEstimate')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('storage.aiModels.catalogEstimateHint')}
          </p>
        </div>
        <p className="text-sm tabular-nums">
          {installedCount === 0
            ? t('storage.aiModels.noneInstalled')
            : t('storage.aiModels.catalogUsed', {
                used: formatBytes(catalogBytes, locale),
                count: installedCount,
              })}
        </p>
        {installedCount > 0 && originBucket?.maxBytes ? (
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(getUsagePercent(catalogBytes, originBucket.maxBytes) ?? 0)}
            aria-label={t('storage.aiModels.catalogEstimate')}
          >
            <div
              className="h-full rounded-full bg-primary/70 transition-[width]"
              style={{
                width: `${getUsagePercent(catalogBytes, originBucket.maxBytes) ?? 0}%`,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const Storage = () => {
  const { t } = useTranslation('settings');
  const { config } = useConfig();
  const { settings } = useSettings();
  const { session, isAuthenticated } = useAuth();
  const storageBaseUrl = getStorageBaseUrl(config);
  const accessToken = session?.accessToken ?? null;
  const aiEnabled = isAiFeatureEnabled(config) && settings.ai?.enabled !== false;
  const remoteConfigured = isStorageSettingsEnabled(config);
  const showRemoteQuota = remoteConfigured && isAuthenticated && Boolean(accessToken);
  const showLocalAi = aiEnabled;

  const [snapshot, setSnapshot] = useState<StorageQuotaSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!storageBaseUrl || !accessToken) {
      setSnapshot(null);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setSnapshot(await fetchStorageQuota(storageBaseUrl, accessToken));
    } catch {
      setSnapshot(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, storageBaseUrl]);

  useEffect(() => {
    if (showRemoteQuota) {
      void load();
    }
  }, [load, showRemoteQuota]);

  if (!showLocalAi && !showRemoteQuota) {
    if (remoteConfigured && (!isAuthenticated || !accessToken)) {
      return <p className="text-sm text-muted-foreground">{t('storage.signInRequired')}</p>;
    }
    return null;
  }

  return (
    <div className="space-y-8">
      {showLocalAi ? <LocalAiModelsUsage /> : null}

      {remoteConfigured ? (
        <div className="space-y-6">
          {showLocalAi ? (
            <h2
              className="text-sm font-medium leading-none"
              style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
            >
              {t('storage.remoteTitle')}
            </h2>
          ) : null}
          <p className="text-sm text-muted-foreground">{t('storage.description')}</p>

          {!isAuthenticated || !accessToken ? (
            <p className="text-sm text-muted-foreground">{t('storage.signInRequired')}</p>
          ) : (
            <>
              {loading && !snapshot ? (
                <p className="text-sm text-muted-foreground">{t('storage.loading')}</p>
              ) : null}

              {error ? (
                <div className="space-y-3">
                  <p className="text-sm text-destructive">{t('storage.error')}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void load()}
                  >
                    {t('storage.retry')}
                  </Button>
                </div>
              ) : null}

              {snapshot ? (
                <div className="space-y-6">
                  <QuotaMeter
                    label={t('storage.yourUsage')}
                    description={
                      snapshot.user.maxBytes === null ? t('storage.noPersonalLimit') : undefined
                    }
                    bucket={snapshot.user}
                  />
                  <QuotaMeter
                    label={t('storage.organization')}
                    bucket={snapshot.company}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
