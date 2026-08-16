import type { ShellUIConfig } from '../config/types';

const QUOTA_PATH = '/storage/v1/quota';
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export type StorageQuotaBucket = {
  maxBytes: number | null;
  usedBytes: number;
  remainingBytes: number | null;
};

export type StorageQuotaSnapshot = {
  companyId: number;
  company: StorageQuotaBucket;
  user: StorageQuotaBucket & { userId: number };
};

export const getStorageBaseUrl = (config: ShellUIConfig | undefined): string | null => {
  const url = config?.storage?.url?.trim().replace(/\/+$/, '') || '';
  return url || null;
};

/** Settings → Storage is shown only when storage.url is set and showInSettings is not false. */
export const isStorageSettingsEnabled = (config: ShellUIConfig | undefined): boolean => {
  if (!getStorageBaseUrl(config)) return false;
  return config?.storage?.showInSettings !== false;
};

export const formatBytes = (bytes: number, locale = 'en'): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${BYTE_UNITS[0]}`;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: exponent === 0 || value >= 10 ? 0 : 1,
  }).format(value);
  return `${formatted} ${BYTE_UNITS[exponent]}`;
};

export const getUsagePercent = (usedBytes: number, maxBytes: number | null): number | null => {
  if (maxBytes === null || !Number.isFinite(maxBytes) || maxBytes <= 0) return null;
  if (!Number.isFinite(usedBytes) || usedBytes <= 0) return 0;
  return Math.min(100, Math.max(0, (usedBytes / maxBytes) * 100));
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseBucket = (value: unknown): StorageQuotaBucket | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const usedBytes = asFiniteNumber(record.used_bytes);
  if (usedBytes === null) return null;
  const rawMax = asFiniteNumber(record.max_bytes);
  const maxBytes = rawMax !== null && rawMax > 0 ? rawMax : null;
  const remainingBytes = asFiniteNumber(record.remaining_bytes);
  return {
    usedBytes,
    maxBytes,
    remainingBytes,
  };
};

export const parseStorageQuota = (payload: unknown): StorageQuotaSnapshot | null => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const companyId = asFiniteNumber(record.company_id);
  const company = parseBucket(record.company);
  const userRaw = record.user;
  if (companyId === null || !company || !userRaw || typeof userRaw !== 'object') return null;
  const userBucket = parseBucket(userRaw);
  const userId = asFiniteNumber((userRaw as Record<string, unknown>).user_id);
  if (!userBucket || userId === null) return null;
  return {
    companyId,
    company,
    user: { ...userBucket, userId },
  };
};

export const fetchStorageQuota = async (
  storageBaseUrl: string,
  accessToken: string,
): Promise<StorageQuotaSnapshot> => {
  const response = await fetch(`${storageBaseUrl.replace(/\/+$/, '')}${QUOTA_PATH}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const snapshot = parseStorageQuota(await response.json());
  if (!snapshot) {
    throw new Error('Invalid quota response');
  }
  return snapshot;
};
