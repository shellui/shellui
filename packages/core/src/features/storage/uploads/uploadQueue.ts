import type { UploadItem, UploadItemStatus, UploadQueueSummary } from './types';

export const UPLOAD_TOAST_ID = 'shellui-upload-progress';
export const UPLOAD_TOAST_DEMO_MESSAGE = 'SHELLUI_UPLOAD_TOAST_DEMO';

type UploadListener = () => void;

type AddUploadInput = {
  id?: string;
  name: string;
  path: string;
  bucket: string;
  size: number;
  demo?: boolean;
};

const listeners = new Set<UploadListener>();
const abortControllers = new Map<string, AbortController>();
const demoTimers = new Map<string, ReturnType<typeof setInterval>>();
const demoStartTimeouts: ReturnType<typeof setTimeout>[] = [];

let items: UploadItem[] = [];
let expanded = false;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function patchItem(id: string, patch: Partial<UploadItem>): void {
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

export function subscribeUploadQueue(listener: UploadListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getUploadQueue(): UploadItem[] {
  return items;
}

export function isUploadToastExpanded(): boolean {
  return expanded;
}

export function setUploadToastExpanded(value: boolean): void {
  if (expanded === value) return;
  expanded = value;
  emit();
}

export function getUploadSummary(list: UploadItem[] = items): UploadQueueSummary {
  const uploading = list.filter((item) => item.status === 'uploading').length;
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
      : uploading > 0
        ? 0
        : list.length > 0
          ? 100
          : 0;

  return {
    total: list.length,
    uploading,
    success,
    error,
    cancelled,
    bytesUploaded,
    bytesTotal,
    percent,
  };
}

export function getItemPercent(item: UploadItem): number {
  if (item.status === 'success') return 100;
  if (item.size <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((item.bytesUploaded / item.size) * 100)));
}

export function addUpload(input: AddUploadInput): { id: string; signal: AbortSignal } {
  const id = input.id ?? createId();
  const existing = abortControllers.get(id);
  existing?.abort();
  clearDemoTimer(id);

  const controller = new AbortController();
  abortControllers.set(id, controller);

  const next: UploadItem = {
    id,
    name: input.name,
    path: input.path,
    bucket: input.bucket,
    size: Math.max(0, input.size),
    bytesUploaded: 0,
    status: 'uploading',
    demo: input.demo,
  };

  items = [...items.filter((item) => item.id !== id), next];
  emit();
  return { id, signal: controller.signal };
}

export function setUploadProgress(id: string, loaded: number, total?: number): void {
  const item = items.find((entry) => entry.id === id);
  if (!item || item.status !== 'uploading') return;
  const size = total && total > 0 ? total : item.size;
  patchItem(id, {
    bytesUploaded: Math.max(0, loaded),
    size: size > 0 ? size : item.size,
  });
}

export function completeUpload(id: string): void {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  abortControllers.delete(id);
  clearDemoTimer(id);
  patchItem(id, {
    status: 'success',
    bytesUploaded: item.size || item.bytesUploaded,
    error: undefined,
  });
}

export function failUpload(id: string, message: string): void {
  if (!items.some((item) => item.id === id)) return;
  abortControllers.delete(id);
  clearDemoTimer(id);
  patchItem(id, { status: 'error', error: message });
}

export function markUploadCancelled(id: string): void {
  if (!items.some((item) => item.id === id)) return;
  abortControllers.delete(id);
  clearDemoTimer(id);
  patchItem(id, { status: 'cancelled' });
}

/** Abort an in-progress upload and remove it from the toaster. */
export function interruptUpload(id: string): void {
  abortControllers.get(id)?.abort();
  abortControllers.delete(id);
  clearDemoTimer(id);
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return;
  items = next;
  if (items.length === 0) expanded = false;
  emit();
}

/** Remove a finished (or cancelled) item from the toaster. Aborts if still uploading. */
export function removeUpload(id: string): void {
  interruptUpload(id);
}

export function dismissFinishedUploads(): void {
  const keep = items.filter((item) => item.status === 'uploading');
  items.forEach((item) => {
    if (item.status === 'uploading') return;
    abortControllers.delete(item.id);
    clearDemoTimer(item.id);
  });
  if (keep.length === items.length) return;
  items = keep;
  if (items.length === 0) expanded = false;
  emit();
}

export function interruptAllUploads(): void {
  const uploading = items.filter((item) => item.status === 'uploading');
  if (uploading.length === 0) return;
  uploading.forEach((item) => {
    abortControllers.get(item.id)?.abort();
    abortControllers.delete(item.id);
    clearDemoTimer(item.id);
  });
  items = items.filter((item) => item.status !== 'uploading');
  if (items.length === 0) expanded = false;
  emit();
}

export function resetUploadQueue(): void {
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
  outcome: Extract<UploadItemStatus, 'success' | 'error'>;
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
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
    return;
  }
  window.postMessage(message, '*');
}

/** Simulated uploads for the Develop panel — no network requests. */
export function startUploadToastDemo(): void {
  clearDemoUploads();
  expanded = false;

  DEMO_FILES.forEach((spec, index) => {
    const timeout = setTimeout(() => {
      const { id, signal } = addUpload({
        name: spec.name,
        path: spec.path,
        bucket: spec.bucket,
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
        setUploadProgress(id, Math.round(spec.size * ratio), spec.size);
        if (ratio < 1) return;
        clearDemoTimer(id);
        if (spec.outcome === 'error') {
          failUpload(id, spec.error || 'Upload failed');
          return;
        }
        completeUpload(id);
      }, 80);
      demoTimers.set(id, timer);
    }, index * 180);
    demoStartTimeouts.push(timeout);
  });
}

export function isUploadSignalAborted(id: string, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || !items.some((item) => item.id === id);
}
