import { describe, expect, it, vi } from 'vitest';
import { StorageClient } from './client.js';
import { normalizeStoragePath } from './paths.js';
import type { StorageTransport } from './transport.js';
import { StorageError, type StorageRequestInput } from './types.js';

function createMockTransport() {
  const requests: StorageRequestInput[] = [];
  const transport: StorageTransport = {
    request: vi.fn(async (payload) => {
      requests.push(payload);
      return { data: { ok: true, ...payload }, error: null };
    }),
  };
  return { transport, requests };
}

describe('normalizeStoragePath', () => {
  it('strips leading and trailing slashes', () => {
    expect(normalizeStoragePath('/docs/reports/')).toBe('docs/reports');
    expect(normalizeStoragePath('docs/reports/q1.pdf')).toBe('docs/reports/q1.pdf');
    expect(normalizeStoragePath('')).toBe('');
    expect(normalizeStoragePath(undefined)).toBe('');
  });
});

describe('StorageClient', () => {
  it('lists buckets', async () => {
    const { transport, requests } = createMockTransport();
    const storage = new StorageClient(transport);
    await storage.listBuckets();
    expect(requests).toEqual([{ op: 'listBuckets' }]);
  });

  it('uploads into nested folders with upsert and content type', async () => {
    const { transport, requests } = createMockTransport();
    const storage = new StorageClient(transport);
    const file = new Blob(['q1'], { type: 'application/pdf' });
    await storage.from('company').upload('docs/reports/2024/q1.pdf', file, {
      upsert: true,
      contentType: 'application/pdf',
    });
    expect(requests[0]).toMatchObject({
      op: 'upload',
      bucket: 'company',
      path: 'docs/reports/2024/q1.pdf',
      upsert: true,
      contentType: 'application/pdf',
    });
    expect((requests[0] as { file: Blob }).file).toBe(file);
  });

  it('lists a nested folder prefix', async () => {
    const { transport, requests } = createMockTransport();
    const storage = new StorageClient(transport);
    await storage.from('company').list('docs/reports', {
      limit: 200,
      sortBy: { column: 'name', order: 'asc' },
    });
    expect(requests[0]).toEqual({
      op: 'list',
      bucket: 'company',
      prefix: 'docs/reports',
      options: { limit: 200, sortBy: { column: 'name', order: 'asc' } },
    });
  });

  it('downloads, moves, and renames files in nested folders', async () => {
    const { transport, requests } = createMockTransport();
    const storage = new StorageClient(transport);
    const bucket = storage.from('company');
    await bucket.download('docs/reports/q1.pdf');
    await bucket.move('docs/reports/q1.pdf', 'archive/2024/q1.pdf');
    await bucket.rename('docs/old.txt', 'docs/new.txt');
    expect(requests.map((r) => r.op)).toEqual(['download', 'move', 'move']);
    expect(requests[1]).toMatchObject({
      fromPath: 'docs/reports/q1.pdf',
      toPath: 'archive/2024/q1.pdf',
      folder: undefined,
    });
    expect(requests[2]).toMatchObject({
      fromPath: 'docs/old.txt',
      toPath: 'docs/new.txt',
    });
  });

  it('moves a folder prefix when folder is true', async () => {
    const { transport, requests } = createMockTransport();
    const storage = new StorageClient(transport);
    await storage.from('company').move('docs/reports', 'archive/reports', { folder: true });
    expect(requests[0]).toMatchObject({
      op: 'move',
      fromPath: 'docs/reports',
      toPath: 'archive/reports',
      folder: true,
    });
  });

  it('removes files, folders, and reports folder stats', async () => {
    const { transport, requests } = createMockTransport();
    const storage = new StorageClient(transport);
    const bucket = storage.from('company');
    await bucket.remove(['docs/reports/q1.pdf', 'docs/reports/q2.pdf']);
    await bucket.removeFolder('docs/reports');
    await bucket.folderStats('docs/reports');
    await bucket.createFolder('docs/reports/2024');
    await new StorageClient(transport).get('folder-uuid-1');
    expect(requests).toEqual([
      {
        op: 'remove',
        bucket: 'company',
        paths: ['docs/reports/q1.pdf', 'docs/reports/q2.pdf'],
      },
      { op: 'removeFolder', bucket: 'company', path: 'docs/reports' },
      { op: 'folderStats', bucket: 'company', path: 'docs/reports' },
      { op: 'createFolder', bucket: 'company', path: 'docs/reports/2024' },
      { op: 'get', objectId: 'folder-uuid-1' },
    ]);
  });

  it('returns transport errors without throwing', async () => {
    const transport: StorageTransport = {
      request: async () => ({
        data: null,
        error: new StorageError('Denied', 403),
      }),
    };
    const { data, error } = await new StorageClient(transport).from('company').list();
    expect(data).toBeNull();
    expect(error?.status).toBe(403);
  });
});
