import { postShellMessage } from '@shellui/sdk';
import type { TransferItem, TransferItemStatus, TransferKind, TransferQueueSummary } from './types';

export const TRANSFER_TOAST_ID = 'shellui-transfer-progress';
/** @deprecated Prefer TRANSFER_TOAST_ID; kept for upload demo message listeners. */
export const UPLOAD_TOAST_ID = TRANSFER_TOAST_ID;
export const UPLOAD_TOAST_DEMO_MESSAGE = 'SHELLUI_UPLOAD_TOAST_DEMO';
/** Brief pause so the success state is visible before the toaster hides. */
export const TRANSFER_TOAST_AUTO_DISMISS_MS = 2500;
export const UPLOAD_TOAST_AUTO_DISMISS_MS = TRANSFER_TOAST_AUTO_DISMISS_MS;

type TransferListener = () => void;

export type AddTransferInput = {
  id?: string;
  kind: TransferKind;
  name: string;
  detail?: string;
  meta?: Record<string, string>;
  size?: number;
  demo?: boolean;
};

const listeners = new Set<TransferListener>();
const abortControllers = new Map<string, AbortController>();
const demoTimers = new Map<string, ReturnType<typeof setInterval>>();
const demoStartTimeouts: ReturnType<typeof setTimeout>[] = [];

let items: TransferItem[] = [];
let expanded = false;
let autoDismissTimeout: ReturnType<typeof setTimeout> | null = null;

function clearAutoDismissTimeout(): void {
  if (autoDismissTimeout === null) return;
  clearTimeout(autoDismissTimeout);
  autoDismissTimeout = null;
}

/**
 * Hide the toaster a few seconds after every transfer finishes successfully.
 * Errors and in-progress transfers keep the panel open; cancelled-only queues stay too.
 */
function scheduleAutoDismissIfNeeded(): void {
  clearAutoDismissTimeout();
  const summary = getTransferSummary();
  if (summary.active > 0 || summary.error > 0 || summary.success === 0) {
    return;
  }
  autoDismissTimeout = setTimeout(() => {
    autoDismissTimeout = null;
    const current = getTransferSummary();
    if (current.active > 0 || current.error > 0 || current.success === 0) {
      return;
    }
    resetTransferQueue();
  }, TRANSFER_TOAST_AUTO_DISMISS_MS);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `transfer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function patchItem(id: string, patch: Partial<TransferItem>): void {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return;
  items = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
  emit();
}

function clearDemoStartTimeouts(): void {
  demoStartTimeouts.forEach((timeout) => clearTimeout(timeout));
  demoStartTimeouts.length = 0;
}

function clearDemoTimer(id: string): void {
  const timer = demoTimers.get(id);
  if (timer !== undefined) {
    clearInterval(timer);
    demoTimers.delete(id);
  }
}

export function subscribeTransferQueue(listener: TransferListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTransferQueue(): TransferItem[] {
  return items;
}

export function isTransferToastExpanded(): boolean {
  return expanded;
}

export function setTransferToastExpanded(value: boolean): void {
  if (expanded === value) return;
  expanded = value;
  emit();
}

export function getItemPercent(item: TransferItem): number {
  if (item.status === 'success') return 100;
  if (typeof item.progressRatio === 'number' && Number.isFinite(item.progressRatio)) {
    return Math.min(100, Math.max(0, Math.round(item.progressRatio * 100)));
  }
  if (item.size <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((item.bytesTransferred / item.size) * 100)));
}

export function getTransferSummary(list: TransferItem[] = items): TransferQueueSummary {
  const active = list.filter((item) => item.status === 'active').length;
  const success = list.filter((item) => item.status === 'success').length;
  const error = list.filter((item) => item.status === 'error').length;
  const cancelled = list.filter((item) => item.status === 'cancelled').length;
  const activeUploads = list.filter(
    (item) => item.status === 'active' && item.kind === 'upload',
  ).length;
  const activeDownloads = list.filter(
    (item) => item.status === 'active' && item.kind === 'download',
  ).length;

  const bytesTransferred = list.reduce((sum, item) => {
    if (item.status === 'success') return sum + (item.size || item.bytesTransferred);
    if (item.status === 'active') {
      if (typeof item.progressRatio === 'number' && item.size > 0) {
        return sum + Math.round(item.size * Math.min(1, Math.max(0, item.progressRatio)));
      }
      return sum + Math.min(item.bytesTransferred, item.size || item.bytesTransferred);
    }
    return sum;
  }, 0);
  const bytesTotal = list.reduce((sum, item) => sum + item.size, 0);

  let percent: number;
  if (bytesTotal > 0) {
    percent = Math.min(100, Math.max(0, Math.round((bytesTransferred / bytesTotal) * 100)));
  } else if (active > 0) {
    const ratios = list
      .filter((item) => item.status === 'active')
      .map((item) =>
        typeof item.progressRatio === 'number' ? Math.min(1, Math.max(0, item.progressRatio)) : 0,
      );
    const avg =
      ratios.length > 0 ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length : 0;
    percent = Math.round(avg * 100);
  } else if (list.length > 0) {
    percent = 100;
  } else {
    percent = 0;
  }

  return {
    total: list.length,
    active,
    success,
    error,
    cancelled,
    bytesTransferred,
    bytesTotal,
    percent,
    activeUploads,
    activeDownloads,
  };
}

export function addTransfer(input: AddTransferInput): { id: string; signal: AbortSignal } {
  clearAutoDismissTimeout();
  const id = input.id ?? createId();
  const existing = abortControllers.get(id);
  existing?.abort();
  clearDemoTimer(id);

  const controller = new AbortController();
  abortControllers.set(id, controller);

  const next: TransferItem = {
    id,
    kind: input.kind,
    name: input.name,
    detail: input.detail,
    meta: input.meta,
    size: Math.max(0, input.size ?? 0),
    bytesTransferred: 0,
    progressRatio: 0,
    status: 'active',
    demo: input.demo,
  };

  items = [...items.filter((item) => item.id !== id), next];
  emit();
  return { id, signal: controller.signal };
}

export type SetTransferProgressInput = {
  loaded?: number;
  total?: number;
  /** Fractional 0–1 progress from the engine (preferred when bytes are coarse). */
  ratio?: number;
};

export function setTransferProgress(id: string, input: SetTransferProgressInput): void {
  const item = items.find((entry) => entry.id === id);
  if (!item || item.status !== 'active') return;

  const patch: Partial<TransferItem> = {};
  if (typeof input.total === 'number' && input.total > 0) {
    patch.size = input.total;
  }
  if (typeof input.ratio === 'number' && Number.isFinite(input.ratio)) {
    const ratio = Math.min(1, Math.max(0, input.ratio));
    patch.progressRatio = ratio;
    const size = patch.size ?? item.size;
    if (size > 0) {
      patch.bytesTransferred = Math.round(size * ratio);
    }
  } else if (typeof input.loaded === 'number') {
    patch.bytesTransferred = Math.max(0, input.loaded);
    const size = patch.size ?? item.size;
    if (size > 0) {
      patch.progressRatio = Math.min(1, Math.max(0, input.loaded / size));
    }
  }
  patchItem(id, patch);
}

export function completeTransfer(id: string): void {
  const item = items.find((entry) => entry.id === id);
  if (!item || item.status !== 'active') return;
  abortControllers.delete(id);
  clearDemoTimer(id);
  patchItem(id, {
    status: 'success',
    bytesTransferred: item.size || item.bytesTransferred,
    progressRatio: 1,
    error: undefined,
  });
  scheduleAutoDismissIfNeeded();
}

export function failTransfer(id: string, message: string): void {
  const item = items.find((entry) => entry.id === id);
  if (!item || item.status !== 'active') return;
  abortControllers.delete(id);
  clearDemoTimer(id);
  patchItem(id, { status: 'error', error: message });
  clearAutoDismissTimeout();
}

export function markTransferCancelled(id: string): void {
  if (!items.some((item) => item.id === id)) return;
  abortControllers.delete(id);
  clearDemoTimer(id);
  patchItem(id, { status: 'cancelled' });
  scheduleAutoDismissIfNeeded();
}

/** Abort an in-progress transfer and keep it visible as cancelled. */
export function interruptTransfer(id: string): void {
  const item = items.find((entry) => entry.id === id);
  if (!item || item.status !== 'active') return;
  abortControllers.get(id)?.abort();
  markTransferCancelled(id);
}

/** Remove a finished (or cancelled) item from the toaster. */
export function removeTransfer(id: string): void {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  if (item.status === 'active') {
    abortControllers.get(id)?.abort();
  }
  abortControllers.delete(id);
  clearDemoTimer(id);
  const next = items.filter((entry) => entry.id !== id);
  if (next.length === items.length) return;
  items = next;
  if (items.length === 0) {
    expanded = false;
    clearAutoDismissTimeout();
  }
  emit();
  if (items.length > 0) {
    scheduleAutoDismissIfNeeded();
  }
}

export function dismissFinishedTransfers(): void {
  clearAutoDismissTimeout();
  const keep = items.filter((item) => item.status === 'active');
  items.forEach((item) => {
    if (item.status === 'active') return;
    abortControllers.delete(item.id);
    clearDemoTimer(item.id);
  });
  if (keep.length === items.length) return;
  items = keep;
  if (items.length === 0) expanded = false;
  emit();
}

export function interruptAllTransfers(): void {
  const active = items.filter((item) => item.status === 'active');
  if (active.length === 0) return;
  active.forEach((item) => {
    abortControllers.get(item.id)?.abort();
    markTransferCancelled(item.id);
  });
}

/** Close the toaster: cancel leftover transfers and hide the panel. */
export function closeTransferToaster(): void {
  resetTransferQueue();
}

export function resetTransferQueue(): void {
  clearAutoDismissTimeout();
  abortControllers.forEach((controller) => controller.abort());
  abortControllers.clear();
  demoTimers.forEach((timer) => clearInterval(timer));
  demoTimers.clear();
  clearDemoStartTimeouts();
  items = [];
  expanded = false;
  emit();
}

const DEMO_FILES: Array<{
  name: string;
  path: string;
  bucket: string;
  size: number;
  durationMs: number;
  outcome: Extract<TransferItemStatus, 'success' | 'error'>;
  error?: string;
}> = [
  {
    name: 'quarterly-report.pdf',
    path: 'docs/quarterly-report.pdf',
    bucket: 'company',
    size: 2_450_000,
    durationMs: 3600,
    outcome: 'success',
  },
  {
    name: 'team-offsite.jpg',
    path: 'photos/team-offsite.jpg',
    bucket: 'company',
    size: 6_200_000,
    durationMs: 7200,
    outcome: 'success',
  },
  {
    name: 'budget.xlsx',
    path: 'docs/budget.xlsx',
    bucket: 'company',
    size: 840_000,
    durationMs: 2400,
    outcome: 'error',
    error: 'Quota exceeded',
  },
  {
    name: 'archive.zip',
    path: 'backup/archive.zip',
    bucket: 'company',
    size: 18_500_000,
    durationMs: 9800,
    outcome: 'success',
  },
];

function clearDemoUploads(): void {
  clearDemoStartTimeouts();
  items
    .filter((item) => item.demo)
    .forEach((item) => {
      abortControllers.get(item.id)?.abort();
      abortControllers.delete(item.id);
      clearDemoTimer(item.id);
    });
  items = items.filter((item) => !item.demo);
  if (items.length === 0) expanded = false;
  emit();
}

/** Ask the root shell to show the demo toaster (no-op network). Safe to call from iframes. */
export function requestUploadToastDemo(): void {
  if (typeof window === 'undefined') return;
  const message = { type: UPLOAD_TOAST_DEMO_MESSAGE, payload: {} };
  postShellMessage(message);
}

/** Simulated uploads for the Develop panel — no network requests. */
export function startUploadToastDemo(): void {
  clearDemoUploads();
  expanded = false;

  DEMO_FILES.forEach((spec, index) => {
    const timeout = setTimeout(() => {
      const { id, signal } = addTransfer({
        kind: 'upload',
        name: spec.name,
        detail: spec.path,
        meta: { bucket: spec.bucket, path: spec.path },
        size: spec.size,
        demo: true,
      });
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (signal.aborted) {
          clearDemoTimer(id);
          return;
        }
        const ratio = Math.min(1, (Date.now() - startedAt) / spec.durationMs);
        setTransferProgress(id, { loaded: Math.round(spec.size * ratio), total: spec.size });
        if (ratio < 1) return;
        clearDemoTimer(id);
        if (spec.outcome === 'error') {
          failTransfer(id, spec.error || 'Upload failed');
          return;
        }
        completeTransfer(id);
      }, 80);
      demoTimers.set(id, timer);
    }, index * 180);
    demoStartTimeouts.push(timeout);
  });
}

export function isTransferSignalAborted(id: string, signal?: AbortSignal): boolean {
  const item = items.find((entry) => entry.id === id);
  return Boolean(signal?.aborted) || !item || item.status === 'cancelled';
}
