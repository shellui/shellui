export type TransferKind = 'upload' | 'download';

/** In-flight transfers use `active`; finished states match the upload toaster UX. */
export type TransferItemStatus = 'active' | 'success' | 'error' | 'cancelled';

export type TransferItem = {
  id: string;
  kind: TransferKind;
  name: string;
  /** Secondary context: storage path for uploads, model id for downloads. */
  detail?: string;
  /** Optional metadata (e.g. bucket for uploads). */
  meta?: Record<string, string>;
  size: number;
  bytesTransferred: number;
  /**
   * Fractional progress 0–1 from the producer (WebLLM init reports, etc.).
   * Used when byte totals are coarse or unknown.
   */
  progressRatio?: number;
  status: TransferItemStatus;
  error?: string;
  demo?: boolean;
};

export type TransferQueueSummary = {
  total: number;
  active: number;
  success: number;
  error: number;
  cancelled: number;
  bytesTransferred: number;
  bytesTotal: number;
  percent: number;
  /** Counts by kind among currently active items. */
  activeUploads: number;
  activeDownloads: number;
};
