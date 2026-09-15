import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addUpload,
  closeUploadToaster,
  completeUpload,
  dismissFinishedUploads,
  failUpload,
  getItemPercent,
  getUploadQueue,
  getUploadSummary,
  interruptAllUploads,
  interruptUpload,
  removeUpload,
  resetUploadQueue,
  setUploadProgress,
  setUploadToastExpanded,
  isUploadToastExpanded,
  UPLOAD_TOAST_AUTO_DISMISS_MS,
} from './uploadQueue';

describe('uploadQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetUploadQueue();
    vi.useRealTimers();
  });

  it('tracks progress and overall percent across files', () => {
    addUpload({
      id: 'a',
      name: 'a.pdf',
      path: 'a.pdf',
      bucket: 'company',
      size: 100,
    });
    addUpload({
      id: 'b',
      name: 'b.pdf',
      path: 'b.pdf',
      bucket: 'company',
      size: 100,
    });
    setUploadProgress('a', 50, 100);
    completeUpload('b');

    const summary = getUploadSummary();
    expect(summary.total).toBe(2);
    expect(summary.uploading).toBe(1);
    expect(summary.success).toBe(1);
    expect(summary.percent).toBe(75);
    expect(getItemPercent(getUploadQueue()[0])).toBe(50);
    expect(getItemPercent(getUploadQueue()[1])).toBe(100);
  });

  it('interrupts an in-progress upload and keeps it as cancelled', () => {
    const { signal } = addUpload({
      id: 'a',
      name: 'a.pdf',
      path: 'a.pdf',
      bucket: 'company',
      size: 10,
    });
    interruptUpload('a');
    expect(signal.aborted).toBe(true);
    expect(getUploadQueue()).toMatchObject([{ id: 'a', status: 'cancelled' }]);
  });

  it('dismisses finished uploads and keeps in-progress ones', () => {
    addUpload({ id: 'up', name: 'up.pdf', path: 'up.pdf', bucket: 'company', size: 10 });
    addUpload({ id: 'ok', name: 'ok.pdf', path: 'ok.pdf', bucket: 'company', size: 10 });
    addUpload({ id: 'bad', name: 'bad.pdf', path: 'bad.pdf', bucket: 'company', size: 10 });
    completeUpload('ok');
    failUpload('bad', 'Denied');
    dismissFinishedUploads();
    expect(getUploadQueue().map((item) => item.id)).toEqual(['up']);
  });

  it('cancels every in-progress upload and leaves them visible as cancelled', () => {
    addUpload({ id: 'up', name: 'up.pdf', path: 'up.pdf', bucket: 'company', size: 10 });
    addUpload({ id: 'ok', name: 'ok.pdf', path: 'ok.pdf', bucket: 'company', size: 10 });
    completeUpload('ok');
    interruptAllUploads();
    expect(getUploadQueue().map((item) => ({ id: item.id, status: item.status }))).toEqual([
      { id: 'up', status: 'cancelled' },
      { id: 'ok', status: 'success' },
    ]);
  });

  it('does not count failed bytes toward overall percent', () => {
    addUpload({ id: 'ok', name: 'ok.pdf', path: 'ok.pdf', bucket: 'company', size: 100 });
    addUpload({ id: 'bad', name: 'bad.pdf', path: 'bad.pdf', bucket: 'company', size: 100 });
    completeUpload('ok');
    setUploadProgress('bad', 80, 100);
    failUpload('bad', 'Denied');
    expect(getUploadSummary().percent).toBe(50);
  });

  it('resets expanded state when the queue is emptied', () => {
    addUpload({ id: 'a', name: 'a.pdf', path: 'a.pdf', bucket: 'company', size: 1 });
    setUploadToastExpanded(true);
    expect(isUploadToastExpanded()).toBe(true);
    removeUpload('a');
    expect(isUploadToastExpanded()).toBe(false);
  });

  it('closes the toaster by cancelling leftover uploads', () => {
    const { signal } = addUpload({
      id: 'up',
      name: 'up.pdf',
      path: 'up.pdf',
      bucket: 'company',
      size: 10,
    });
    addUpload({ id: 'ok', name: 'ok.pdf', path: 'ok.pdf', bucket: 'company', size: 10 });
    completeUpload('ok');
    closeUploadToaster();
    expect(signal.aborted).toBe(true);
    expect(getUploadQueue()).toEqual([]);
    expect(isUploadToastExpanded()).toBe(false);
  });

  it('auto-dismisses the toaster a few seconds after all uploads succeed', () => {
    addUpload({ id: 'a', name: 'a.pdf', path: 'a.pdf', bucket: 'company', size: 10 });
    addUpload({ id: 'b', name: 'b.pdf', path: 'b.pdf', bucket: 'company', size: 10 });
    completeUpload('a');
    expect(getUploadQueue()).toHaveLength(2);
    completeUpload('b');
    expect(getUploadQueue()).toHaveLength(2);

    vi.advanceTimersByTime(UPLOAD_TOAST_AUTO_DISMISS_MS - 1);
    expect(getUploadQueue()).toHaveLength(2);

    vi.advanceTimersByTime(1);
    expect(getUploadQueue()).toEqual([]);
  });

  it('does not auto-dismiss when any upload fails', () => {
    addUpload({ id: 'ok', name: 'ok.pdf', path: 'ok.pdf', bucket: 'company', size: 10 });
    addUpload({ id: 'bad', name: 'bad.pdf', path: 'bad.pdf', bucket: 'company', size: 10 });
    completeUpload('ok');
    failUpload('bad', 'Denied');

    vi.advanceTimersByTime(UPLOAD_TOAST_AUTO_DISMISS_MS * 2);
    expect(getUploadQueue()).toHaveLength(2);
    expect(getUploadQueue().map((item) => item.status)).toEqual(['success', 'error']);
  });

  it('cancels a pending auto-dismiss when a new upload starts', () => {
    addUpload({ id: 'ok', name: 'ok.pdf', path: 'ok.pdf', bucket: 'company', size: 10 });
    completeUpload('ok');

    vi.advanceTimersByTime(UPLOAD_TOAST_AUTO_DISMISS_MS - 100);
    addUpload({ id: 'next', name: 'next.pdf', path: 'next.pdf', bucket: 'company', size: 10 });

    vi.advanceTimersByTime(UPLOAD_TOAST_AUTO_DISMISS_MS);
    expect(getUploadQueue().map((item) => item.id)).toEqual(['ok', 'next']);
  });

  it('cancels a pending auto-dismiss when the toaster is closed manually', () => {
    addUpload({ id: 'ok', name: 'ok.pdf', path: 'ok.pdf', bucket: 'company', size: 10 });
    completeUpload('ok');
    closeUploadToaster();
    expect(getUploadQueue()).toEqual([]);

    addUpload({ id: 'again', name: 'again.pdf', path: 'again.pdf', bucket: 'company', size: 10 });
    vi.advanceTimersByTime(UPLOAD_TOAST_AUTO_DISMISS_MS);
    expect(getUploadQueue()).toHaveLength(1);
    expect(getUploadQueue()[0]?.status).toBe('uploading');
  });
});
