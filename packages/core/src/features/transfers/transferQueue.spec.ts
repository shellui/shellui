import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapInitProgress } from '../ai/engine/mapInitProgress.js';
import {
  addTransfer,
  closeTransferToaster,
  completeTransfer,
  failTransfer,
  getItemPercent,
  getTransferQueue,
  getTransferSummary,
  interruptTransfer,
  resetTransferQueue,
  setTransferProgress,
  TRANSFER_TOAST_AUTO_DISMISS_MS,
} from './transferQueue';

describe('transferQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetTransferQueue();
    vi.useRealTimers();
  });

  it('tracks upload and download progress in one queue', () => {
    addTransfer({
      id: 'up',
      kind: 'upload',
      name: 'a.pdf',
      detail: 'a.pdf',
      size: 100,
    });
    addTransfer({
      id: 'dl',
      kind: 'download',
      name: 'Llama 3.2',
      detail: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      size: 700_000_000,
    });
    setTransferProgress('up', { loaded: 50, total: 100 });
    setTransferProgress('dl', { ratio: 0.25 });

    const summary = getTransferSummary();
    expect(summary.total).toBe(2);
    expect(summary.active).toBe(2);
    expect(summary.activeUploads).toBe(1);
    expect(summary.activeDownloads).toBe(1);
    expect(getItemPercent(getTransferQueue().find((i) => i.id === 'dl')!)).toBe(25);
    expect(getTransferQueue().find((i) => i.id === 'dl')?.bytesTransferred).toBe(175_000_000);
  });

  it('supports ratio-only progress when size is unknown', () => {
    addTransfer({ id: 'dl', kind: 'download', name: 'Model', size: 0 });
    setTransferProgress('dl', { ratio: 0.4 });
    expect(getItemPercent(getTransferQueue()[0]!)).toBe(40);
    expect(getTransferSummary().percent).toBe(40);
  });

  it('interrupts a download and marks it cancelled', () => {
    const { signal } = addTransfer({ id: 'dl', kind: 'download', name: 'Model', size: 10 });
    interruptTransfer('dl');
    expect(signal.aborted).toBe(true);
    expect(getTransferQueue()).toMatchObject([{ id: 'dl', status: 'cancelled' }]);
  });

  it('auto-dismisses after successful transfers', () => {
    addTransfer({ id: 'a', kind: 'upload', name: 'a.pdf', size: 10 });
    completeTransfer('a');
    vi.advanceTimersByTime(TRANSFER_TOAST_AUTO_DISMISS_MS);
    expect(getTransferQueue()).toEqual([]);
  });

  it('keeps errors visible', () => {
    addTransfer({ id: 'a', kind: 'download', name: 'Model', size: 10 });
    failTransfer('a', 'WebGPU lost');
    vi.advanceTimersByTime(TRANSFER_TOAST_AUTO_DISMISS_MS * 2);
    expect(getTransferQueue()).toHaveLength(1);
    expect(getTransferQueue()[0]?.status).toBe('error');
  });

  it('closeTransferToaster clears the queue', () => {
    addTransfer({ id: 'a', kind: 'download', name: 'Model', size: 10 });
    closeTransferToaster();
    expect(getTransferQueue()).toEqual([]);
  });
});

describe('mapInitProgress', () => {
  it('clamps WebLLM init progress reports to 0–1', () => {
    expect(mapInitProgress({ progress: 0.42 })).toBe(0.42);
    expect(mapInitProgress({ progress: -1 })).toBe(0);
    expect(mapInitProgress({ progress: 2 })).toBe(1);
    expect(mapInitProgress({ progress: Number.NaN })).toBe(0);
  });
});
