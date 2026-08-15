import { afterEach, describe, expect, it } from 'vitest';
import {
  addUpload,
  completeUpload,
  dismissFinishedUploads,
  failUpload,
  getItemPercent,
  getUploadQueue,
  getUploadSummary,
  interruptAllUploads,
  interruptUpload,
  resetUploadQueue,
  setUploadProgress,
  setUploadToastExpanded,
  isUploadToastExpanded,
} from './uploadQueue';

describe('uploadQueue', () => {
  afterEach(() => {
    resetUploadQueue();
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

  it('interrupts an in-progress upload and removes it', () => {
    const { signal } = addUpload({
      id: 'a',
      name: 'a.pdf',
      path: 'a.pdf',
      bucket: 'company',
      size: 10,
    });
    interruptUpload('a');
    expect(signal.aborted).toBe(true);
    expect(getUploadQueue()).toEqual([]);
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

  it('cancels every in-progress upload and leaves finished items', () => {
    addUpload({ id: 'up', name: 'up.pdf', path: 'up.pdf', bucket: 'company', size: 10 });
    addUpload({ id: 'ok', name: 'ok.pdf', path: 'ok.pdf', bucket: 'company', size: 10 });
    completeUpload('ok');
    interruptAllUploads();
    expect(getUploadQueue().map((item) => item.id)).toEqual(['ok']);
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
    interruptUpload('a');
    expect(isUploadToastExpanded()).toBe(false);
  });
});
