/**
 * Upload-shaped façade over the shared transfer queue.
 * Prefer `features/transfers` for new code; these helpers keep storage callers stable.
 */
import type { TransferItem, TransferQueueSummary } from '../../transfers/types.js';
import {
  addTransfer,
  closeTransferToaster,
  completeTransfer,
  dismissFinishedTransfers,
  failTransfer,
  getItemPercent as getTransferItemPercent,
  getTransferQueue,
  getTransferSummary,
  interruptAllTransfers,
  interruptTransfer,
  isTransferSignalAborted,
  isTransferToastExpanded,
  markTransferCancelled,
  removeTransfer,
  requestUploadToastDemo as requestDemo,
  resetTransferQueue,
  setTransferProgress,
  setTransferToastExpanded,
  startUploadToastDemo as startDemo,
  subscribeTransferQueue,
  TRANSFER_TOAST_AUTO_DISMISS_MS,
  TRANSFER_TOAST_ID,
  UPLOAD_TOAST_DEMO_MESSAGE as DEMO_MESSAGE,
} from '../../transfers/transferQueue.js';
import type { UploadItem, UploadItemStatus, UploadQueueSummary } from './types';

export const UPLOAD_TOAST_ID = TRANSFER_TOAST_ID;
export const UPLOAD_TOAST_DEMO_MESSAGE = DEMO_MESSAGE;
export const UPLOAD_TOAST_AUTO_DISMISS_MS = TRANSFER_TOAST_AUTO_DISMISS_MS;

type AddUploadInput = {
  id?: string;
  name: string;
  path: string;
  bucket: string;
  size: number;
  demo?: boolean;
};

function toUploadStatus(status: TransferItem['status']): UploadItemStatus {
  return status === 'active' ? 'uploading' : status;
}

function toUploadItem(item: TransferItem): UploadItem {
  return {
    id: item.id,
    name: item.name,
    path: item.detail ?? item.meta?.path ?? '',
    bucket: item.meta?.bucket ?? '',
    size: item.size,
    bytesUploaded: item.bytesTransferred,
    status: toUploadStatus(item.status),
    error: item.error,
    demo: item.demo,
  };
}

function toUploadSummary(summary: TransferQueueSummary): UploadQueueSummary {
  return {
    total: summary.total,
    uploading: summary.active,
    success: summary.success,
    error: summary.error,
    cancelled: summary.cancelled,
    bytesUploaded: summary.bytesTransferred,
    bytesTotal: summary.bytesTotal,
    percent: summary.percent,
  };
}

export function subscribeUploadQueue(listener: () => void): () => void {
  return subscribeTransferQueue(listener);
}

export function getUploadQueue(): UploadItem[] {
  return getTransferQueue()
    .filter((item) => item.kind === 'upload')
    .map(toUploadItem);
}

/** All transfer items as upload-shaped rows (tests / legacy callers that expect the full queue). */
export function getUploadQueueIncludingDownloads(): UploadItem[] {
  return getTransferQueue().map(toUploadItem);
}

export function isUploadToastExpanded(): boolean {
  return isTransferToastExpanded();
}

export function setUploadToastExpanded(value: boolean): void {
  setTransferToastExpanded(value);
}

export function getUploadSummary(list?: UploadItem[]): UploadQueueSummary {
  if (list) {
    const active = list.filter((item) => item.status === 'uploading').length;
    const success = list.filter((item) => item.status === 'success').length;
    const error = list.filter((item) => item.status === 'error').length;
    const cancelled = list.filter((item) => item.status === 'cancelled').length;
    const bytesUploaded = list.reduce((sum, item) => {
      if (item.status === 'success') return sum + item.size;
      if (item.status === 'uploading') {
        return sum + Math.min(item.bytesUploaded, item.size || item.bytesUploaded);
      }
      return sum;
    }, 0);
    const bytesTotal = list.reduce((sum, item) => sum + item.size, 0);
    const percent =
      bytesTotal > 0
        ? Math.min(100, Math.max(0, Math.round((bytesUploaded / bytesTotal) * 100)))
        : active > 0
          ? 0
          : list.length > 0
            ? 100
            : 0;
    return {
      total: list.length,
      uploading: active,
      success,
      error,
      cancelled,
      bytesUploaded,
      bytesTotal,
      percent,
    };
  }
  return toUploadSummary(getTransferSummary());
}

export function getItemPercent(item: UploadItem): number {
  if (item.status === 'success') return 100;
  if (item.size <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((item.bytesUploaded / item.size) * 100)));
}

export function addUpload(input: AddUploadInput): { id: string; signal: AbortSignal } {
  return addTransfer({
    id: input.id,
    kind: 'upload',
    name: input.name,
    detail: input.path,
    meta: { path: input.path, bucket: input.bucket },
    size: input.size,
    demo: input.demo,
  });
}

export function setUploadProgress(id: string, loaded: number, total?: number): void {
  setTransferProgress(id, { loaded, total });
}

export function completeUpload(id: string): void {
  completeTransfer(id);
}

export function failUpload(id: string, message: string): void {
  failTransfer(id, message);
}

export function markUploadCancelled(id: string): void {
  markTransferCancelled(id);
}

export function interruptUpload(id: string): void {
  interruptTransfer(id);
}

export function removeUpload(id: string): void {
  removeTransfer(id);
}

export function dismissFinishedUploads(): void {
  dismissFinishedTransfers();
}

export function interruptAllUploads(): void {
  interruptAllTransfers();
}

export function closeUploadToaster(): void {
  closeTransferToaster();
}

export function resetUploadQueue(): void {
  resetTransferQueue();
}

export function requestUploadToastDemo(): void {
  requestDemo();
}

export function startUploadToastDemo(): void {
  startDemo();
}

export function isUploadSignalAborted(id: string, signal?: AbortSignal): boolean {
  return isTransferSignalAborted(id, signal);
}

/** Re-export for callers that still import percent helpers from this module. */
export { getTransferItemPercent };
