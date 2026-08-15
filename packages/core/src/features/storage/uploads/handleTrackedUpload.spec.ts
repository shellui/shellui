import { afterEach, describe, expect, it, vi } from 'vitest';
import { FOLDER_PLACEHOLDER } from '../api';
import { getUploadQueue, interruptUpload, resetUploadQueue } from './uploadQueue';
import { getUploadDisplayName, handleTrackedUpload } from './handleTrackedUpload';

class MockXHR {
  static last: MockXHR | null = null;
  status = 0;
  statusText = '';
  responseText = '';
  upload: {
    onprogress:
      | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void)
      | null;
  } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  headers: Record<string, string> = {};
  body: unknown = null;
  aborted = false;

  constructor() {
    MockXHR.last = this;
  }

  open(): void {}

  setRequestHeader(key: string, value: string): void {
    this.headers[key] = value;
  }

  send(body: unknown): void {
    this.body = body;
  }

  abort(): void {
    this.aborted = true;
    this.onabort?.();
  }
}

describe('handleTrackedUpload', () => {
  afterEach(() => {
    resetUploadQueue();
    vi.unstubAllGlobals();
    MockXHR.last = null;
  });

  it('derives a display name from the path when the blob has no name', () => {
    expect(getUploadDisplayName('docs/reports/q1.pdf', new Blob(['x']))).toBe('q1.pdf');
  });

  it('skips the toast for folder placeholder uploads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
      }),
    );
    await expect(
      handleTrackedUpload({
        storageUrl: 'http://localhost:8001',
        accessToken: 'token',
        payload: {
          id: 'folder-1',
          op: 'upload',
          bucket: 'company',
          path: `docs/${FOLDER_PLACEHOLDER}`,
          file: new Blob([]),
        },
      }),
    ).resolves.toEqual({ id: 'folder-1', data: { path: `docs/${FOLDER_PLACEHOLDER}` } });
    expect(getUploadQueue()).toEqual([]);
  });

  it('records progress then success on the upload queue', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXHR);
    const file = new Blob(['hello-world']);
    const pending = handleTrackedUpload({
      storageUrl: 'http://localhost:8001',
      accessToken: 'token',
      payload: {
        id: 'up-1',
        op: 'upload',
        bucket: 'company',
        path: 'docs/notes.txt',
        file,
        upsert: true,
        contentType: 'text/plain',
      },
    });

    const xhr = MockXHR.last;
    expect(xhr).toBeTruthy();
    expect(xhr?.headers.Authorization).toBe('Bearer token');
    expect(xhr?.headers['Content-Type']).toBe('text/plain');
    expect(xhr?.headers['x-upsert']).toBe('true');
    xhr?.upload.onprogress?.({ lengthComputable: true, loaded: 4, total: 11 });
    expect(getUploadQueue()[0]).toMatchObject({
      id: 'up-1',
      name: 'notes.txt',
      status: 'uploading',
      bytesUploaded: 4,
      size: 11,
    });

    xhr!.status = 200;
    xhr!.onload?.();
    await expect(pending).resolves.toEqual({ id: 'up-1', data: { path: 'docs/notes.txt' } });
    expect(getUploadQueue()[0].status).toBe('success');
  });

  it('maps http failures onto the queue and response', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXHR);
    const pending = handleTrackedUpload({
      storageUrl: 'http://localhost:8001',
      accessToken: 'token',
      payload: {
        id: 'up-2',
        op: 'upload',
        bucket: 'company',
        path: 'docs/notes.txt',
        file: new Blob(['x']),
      },
    });
    const xhr = MockXHR.last!;
    xhr.status = 403;
    xhr.statusText = 'Forbidden';
    xhr.responseText = JSON.stringify({ message: 'Denied' });
    xhr.onload?.();
    await expect(pending).resolves.toEqual({
      id: 'up-2',
      error: { message: 'Denied', status: 403 },
    });
    expect(getUploadQueue()[0]).toMatchObject({ status: 'error', error: 'Denied' });
  });

  it('returns a cancelled error when the user interrupts the upload', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXHR);
    const pending = handleTrackedUpload({
      storageUrl: 'http://localhost:8001',
      accessToken: 'token',
      payload: {
        id: 'up-3',
        op: 'upload',
        bucket: 'company',
        path: 'docs/notes.txt',
        file: new Blob(['x']),
      },
    });
    interruptUpload('up-3');
    await expect(pending).resolves.toEqual({
      id: 'up-3',
      error: { message: 'Upload cancelled', status: 499, code: 'cancelled' },
    });
    expect(getUploadQueue()).toEqual([]);
  });
});
