import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../auth/hooks/useAuth';
import { useConfig } from '../../config/useConfig';
import {
  fetchStorageQuota,
  formatBytes,
  getStorageBaseUrl,
  getUsagePercent,
  type StorageQuotaBucket,
  type StorageQuotaSnapshot,
} from '../../storage/quota';

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

export const Storage = () => {
  const { t } = useTranslation('settings');
  const { config } = useConfig();
  const { session, isAuthenticated } = useAuth();
  const storageBaseUrl = getStorageBaseUrl(config);
  const accessToken = session?.accessToken ?? null;

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
    void load();
  }, [load]);

  if (!isAuthenticated || !accessToken) {
    return <p className="text-sm text-muted-foreground">{t('storage.signInRequired')}</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('storage.description')}</p>

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
            description={snapshot.user.maxBytes === null ? t('storage.noPersonalLimit') : undefined}
            bucket={snapshot.user}
          />
          <QuotaMeter
            label={t('storage.organization')}
            bucket={snapshot.company}
          />
        </div>
      ) : null}
    </div>
  );
};
