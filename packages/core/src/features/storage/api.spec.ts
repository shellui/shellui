import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  encodeObjectPath,
  executeStorageOp,
  FOLDER_PLACEHOLDER,
  isFolderPlaceholderPath,
  normalizeStoragePath,
} from './api';

const baseUrl = 'http://localhost:8001';
const token = 'token-1';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => body,
    blob: async () => new Blob(),
  } as Response;
}

describe('encodeObjectPath', () => {
  it('encodes nested folder segments', () => {
    expect(encodeObjectPath('company', 'docs/reports/2024/q1.pdf')).toBe(
      'company/docs/reports/2024/q1.pdf',
    );
    expect(encodeObjectPath('company', '/docs/reports/q1.pdf/')).toBe(
      'company/docs/reports/q1.pdf',
    );
    expect(encodeObjectPath('my bucket', 'a b/c.pdf')).toBe('my%20bucket/a%20b/c.pdf');
  });
});

describe('normalizeStoragePath', () => {
  it('strips slashes', () => {
    expect(normalizeStoragePath('/docs/reports/')).toBe('docs/reports');
  });
});

describe('isFolderPlaceholderPath', () => {
  it('detects the folder marker at any depth', () => {
    expect(isFolderPlaceholderPath(FOLDER_PLACEHOLDER)).toBe(true);
    expect(isFolderPlaceholderPath(`docs/${FOLDER_PLACEHOLDER}`)).toBe(true);
    expect(isFolderPlaceholderPath('docs/q1.pdf')).toBe(false);
  });
});

describe('executeStorageOp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists buckets', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ name: 'company' }]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(executeStorageOp(baseUrl, token, { op: 'listBuckets' })).resolves.toEqual([
      { name: 'company' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8001/storage/v1/bucket', {
      headers: expect.any(Headers),
    });
  });

  it('lists a nested prefix and hides folder placeholders', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        { name: 'q1.pdf', id: '1' },
        { name: FOLDER_PLACEHOLDER, id: '2' },
        { name: '2024', id: null },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      executeStorageOp(baseUrl, token, {
        op: 'list',
        bucket: 'company',
        prefix: 'docs/reports',
        options: { limit: 200 },
      }),
    ).resolves.toEqual([
      { name: 'q1.pdf', id: '1' },
      { name: '2024', id: null },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8001/storage/v1/object/list/company',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          prefix: 'docs/reports',
          limit: 200,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        }),
      }),
    );
  });

  it('uploads a file into a nested path with upsert', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const file = new Blob(['pdf'], { type: 'application/pdf' });

    await expect(
      executeStorageOp(baseUrl, token, {
        op: 'upload',
        bucket: 'company',
        path: 'docs/reports/2024/q1.pdf',
        file,
        upsert: true,
        contentType: 'application/pdf',
      }),
    ).resolves.toEqual({ path: 'docs/reports/2024/q1.pdf' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8001/storage/v1/object/company/docs/reports/2024/q1.pdf',
      expect.objectContaining({
        method: 'POST',
        body: file,
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-1');
    expect(headers.get('Content-Type')).toBe('application/pdf');
    expect(headers.get('x-upsert')).toBe('true');
  });

  it('downloads nested objects as blobs', async () => {
    const blob = new Blob(['bytes']);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      blob: async () => blob,
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      executeStorageOp(baseUrl, token, {
        op: 'download',
        bucket: 'company',
        path: 'docs/reports/q1.pdf',
      }),
    ).resolves.toBe(blob);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8001/storage/v1/object/company/docs/reports/q1.pdf',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-1' },
      }),
    );
  });

  it('moves a file with bucket-qualified nested paths', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    await executeStorageOp(baseUrl, token, {
      op: 'move',
      bucket: 'company',
      fromPath: 'docs/reports/q1.pdf',
      toPath: 'archive/2024/q1.pdf',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8001/storage/v1/object/move',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          from: 'company/docs/reports/q1.pdf',
          to: 'company/archive/2024/q1.pdf',
        }),
      }),
    );
  });

  it('moves a folder prefix', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ moved: 3 }));
    vi.stubGlobal('fetch', fetchMock);
    await executeStorageOp(baseUrl, token, {
      op: 'move',
      bucket: 'company',
      fromPath: 'docs/reports',
      toPath: 'archive/reports',
      folder: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8001/storage/v1/object/prefix/company',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ from: 'docs/reports', to: 'archive/reports' }),
      }),
    );
  });

  it('creates a nested folder via placeholder upload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      executeStorageOp(baseUrl, token, {
        op: 'createFolder',
        bucket: 'company',
        path: 'docs/reports/2024',
      }),
    ).resolves.toEqual({ path: 'docs/reports/2024' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `http://localhost:8001/storage/v1/object/company/docs/reports/2024/${FOLDER_PLACEHOLDER}`,
    );
  });

  it('removes files and folder prefixes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ count: 2 }, 200));
    vi.stubGlobal('fetch', fetchMock);
    await executeStorageOp(baseUrl, token, {
      op: 'remove',
      bucket: 'company',
      paths: ['docs/a.pdf'],
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:8001/storage/v1/object/company/docs/a.pdf',
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'DELETE' }));

    await executeStorageOp(baseUrl, token, {
      op: 'removeFolder',
      bucket: 'company',
      path: 'docs/reports',
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'http://localhost:8001/storage/v1/object/prefix/company',
    );
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ prefix: 'docs/reports' }),
      }),
    );
  });

  it('requests folder stats for a nested prefix', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ file_count: 4 }));
    vi.stubGlobal('fetch', fetchMock);
    await executeStorageOp(baseUrl, token, {
      op: 'folderStats',
      bucket: 'company',
      path: 'docs/reports/2024',
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:8001/storage/v1/object/prefix/company?prefix=docs%2Freports%2F2024',
    );
  });

  it('throws mapped http errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'Denied', error: 'access_denied' }),
      }),
    );
    await expect(executeStorageOp(baseUrl, token, { op: 'listBuckets' })).rejects.toMatchObject({
      status: 403,
      code: 'access_denied',
      message: 'Denied',
    });
  });
});
