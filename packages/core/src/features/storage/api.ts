import type { StorageRequestInput, StorageRequestPayload } from '@shellui/sdk';

export const FOLDER_PLACEHOLDER = '.emptyFolderPlaceholder';

export class StorageHttpError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'StorageHttpError';
    this.status = status;
    this.code = code;
  }
}

export function normalizeStoragePath(path: string | undefined | null): string {
  if (!path) return '';
  return path.replace(/^\/+|\/+$/g, '');
}

export function encodeObjectPath(bucket: string, path: string): string {
  const trimmed = normalizeStoragePath(path);
  const segments = trimmed ? trimmed.split('/').map(encodeURIComponent) : [];
  return [encodeURIComponent(bucket), ...segments].join('/');
}

function objectUrl(storageBaseUrl: string, bucket: string, path: string): string {
  return `${storageBaseUrl}/storage/v1/object/${encodeObjectPath(bucket, path)}`;
}

async function parseError(response: Response): Promise<StorageHttpError> {
  let message = response.statusText || 'Request failed';
  let code: string | undefined;
  try {
    const body = (await response.json()) as { message?: string; error?: string; detail?: string };
    message = body.message || body.error || body.detail || message;
    code = body.error;
  } catch {
    /* ignore */
  }
  return new StorageHttpError(message, response.status, code);
}

async function request<T>(
  storageBaseUrl: string,
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof Blob) && !(init.body instanceof FormData)) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${storageBaseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return undefined as T;
}

export async function listBuckets(storageBaseUrl: string, accessToken: string): Promise<unknown> {
  return request(storageBaseUrl, '/storage/v1/bucket', accessToken);
}

export async function listObjects(
  storageBaseUrl: string,
  accessToken: string,
  bucket: string,
  prefix = '',
  options: {
    limit?: number;
    offset?: number;
    sortBy?: { column: string; order: 'asc' | 'desc' };
  } = {},
): Promise<unknown> {
  const entries = await request<Array<{ name?: string }>>(
    storageBaseUrl,
    `/storage/v1/object/list/${encodeURIComponent(bucket)}`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        prefix: normalizeStoragePath(prefix),
        limit: options.limit ?? 100,
        offset: options.offset ?? 0,
        sortBy: options.sortBy ?? { column: 'name', order: 'asc' },
      }),
    },
  );
  return entries.filter((item) => item.name !== FOLDER_PLACEHOLDER);
}

export function isFolderPlaceholderPath(path: string | undefined | null): boolean {
  const normalized = normalizeStoragePath(path);
  return normalized === FOLDER_PLACEHOLDER || normalized.endsWith(`/${FOLDER_PLACEHOLDER}`);
}

export type UploadProgressHandler = (loaded: number, total: number) => void;

export type UploadObjectOptions = {
  upsert?: boolean;
  contentType?: string;
  signal?: AbortSignal;
  onProgress?: UploadProgressHandler;
};

function parseXhrError(xhr: XMLHttpRequest): StorageHttpError {
  let message = xhr.statusText || 'Request failed';
  let code: string | undefined;
  try {
    const body = JSON.parse(xhr.responseText) as {
      message?: string;
      error?: string;
      detail?: string;
    };
    message = body.message || body.error || body.detail || message;
    code = typeof body.error === 'string' ? body.error : undefined;
  } catch {
    /* ignore */
  }
  return new StorageHttpError(message, xhr.status, code);
}

/** Upload with progress events and abort support (XMLHttpRequest). */
export function uploadObjectWithProgress(
  storageBaseUrl: string,
  accessToken: string,
  bucket: string,
  path: string,
  file: Blob,
  options: UploadObjectOptions = {},
): Promise<{ path: string }> {
  const normalized = normalizeStoragePath(path);
  const contentType = options.contentType || file.type || 'application/octet-stream';

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', objectUrl(storageBaseUrl, bucket, normalized));
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', contentType);
    if (options.upsert) xhr.setRequestHeader('x-upsert', 'true');

    xhr.upload.onprogress = (event) => {
      if (!options.onProgress) return;
      const total = event.lengthComputable ? event.total : file.size;
      options.onProgress(event.loaded, total);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ path: normalized });
        return;
      }
      reject(parseXhrError(xhr));
    };
    xhr.onerror = () => {
      reject(new StorageHttpError('Network error', 0));
    };
    xhr.onabort = () => {
      reject(new StorageHttpError('Upload cancelled', 499, 'cancelled'));
    };

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
        return;
      }
      options.signal.addEventListener(
        'abort',
        () => {
          xhr.abort();
        },
        { once: true },
      );
    }

    xhr.send(file);
  });
}

export async function uploadObject(
  storageBaseUrl: string,
  accessToken: string,
  bucket: string,
  path: string,
  file: Blob,
  options: { upsert?: boolean; contentType?: string } = {},
): Promise<{ path: string }> {
  const normalized = normalizeStoragePath(path);
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Content-Type', options.contentType || file.type || 'application/octet-stream');
  if (options.upsert) headers.set('x-upsert', 'true');

  const response = await fetch(objectUrl(storageBaseUrl, bucket, normalized), {
    method: 'POST',
    headers,
    body: file,
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return { path: normalized };
}

export async function downloadObject(
  storageBaseUrl: string,
  accessToken: string,
  bucket: string,
  path: string,
): Promise<Blob> {
  const response = await fetch(objectUrl(storageBaseUrl, bucket, path), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return response.blob();
}

export async function moveObject(
  storageBaseUrl: string,
  accessToken: string,
  bucket: string,
  fromPath: string,
  toPath: string,
): Promise<{ path: string }> {
  const from = normalizeStoragePath(fromPath);
  const to = normalizeStoragePath(toPath);
  await request(storageBaseUrl, '/storage/v1/object/move', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      from: `${bucket}/${from}`,
      to: `${bucket}/${to}`,
    }),
  });
  return { path: to };
}

export async function moveFolder(
  storageBaseUrl: string,
  accessToken: string,
  bucket: string,
  fromPath: string,
  toPath: string,
): Promise<unknown> {
  const from = normalizeStoragePath(fromPath);
  const to = normalizeStoragePath(toPath);
  return request(
    storageBaseUrl,
    `/storage/v1/object/prefix/${encodeURIComponent(bucket)}`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ from, to }),
    },
  );
}

export async function removeObjects(
  storageBaseUrl: string,
  accessToken: string,
  bucket: string,
  paths: string[],
): Promise<{ path: string }[]> {
  const removed: { path: string }[] = [];
  for (const path of paths) {
    const normalized = normalizeStoragePath(path);
    await request(
      storageBaseUrl,
      `/storage/v1/object/${encodeObjectPath(bucket, normalized)}`,
      accessToken,
      {
        method: 'DELETE',
      },
    );
    removed.push({ path: normalized });
  }
  return removed;
}

export async function removeFolder(
  storageBaseUrl: string,
  accessToken: string,
  bucket: string,
  path: string,
): Promise<unknown> {
  return request(
    storageBaseUrl,
    `/storage/v1/object/prefix/${encodeURIComponent(bucket)}`,
    accessToken,
    {
      method: 'DELETE',
      body: JSON.stringify({ prefix: normalizeStoragePath(path) }),
    },
  );
}

export async function createFolder(
  storageBaseUrl: string,
  accessToken: string,
  bucket: string,
  path: string,
): Promise<{ path: string }> {
  const folderPath = normalizeStoragePath(path);
  const markerPath = folderPath ? `${folderPath}/${FOLDER_PLACEHOLDER}` : FOLDER_PLACEHOLDER;
  const marker = new Blob([], { type: 'application/x-directory' });
  await uploadObject(storageBaseUrl, accessToken, bucket, markerPath, marker, {
    upsert: true,
    contentType: 'application/x-directory',
  });
  return { path: folderPath };
}

export async function folderStats(
  storageBaseUrl: string,
  accessToken: string,
  bucket: string,
  path: string,
): Promise<unknown> {
  const prefix = encodeURIComponent(normalizeStoragePath(path));
  return request(
    storageBaseUrl,
    `/storage/v1/object/prefix/${encodeURIComponent(bucket)}?prefix=${prefix}`,
    accessToken,
  );
}

export async function executeStorageOp(
  storageBaseUrl: string,
  accessToken: string,
  payload: StorageRequestInput | StorageRequestPayload,
): Promise<unknown> {
  switch (payload.op) {
    case 'listBuckets':
      return listBuckets(storageBaseUrl, accessToken);
    case 'list':
      return listObjects(
        storageBaseUrl,
        accessToken,
        payload.bucket,
        payload.prefix,
        payload.options,
      );
    case 'upload':
      return uploadObject(storageBaseUrl, accessToken, payload.bucket, payload.path, payload.file, {
        upsert: payload.upsert,
        contentType: payload.contentType,
      });
    case 'download':
      return downloadObject(storageBaseUrl, accessToken, payload.bucket, payload.path);
    case 'move':
      if (payload.folder) {
        return moveFolder(
          storageBaseUrl,
          accessToken,
          payload.bucket,
          payload.fromPath,
          payload.toPath,
        );
      }
      return moveObject(
        storageBaseUrl,
        accessToken,
        payload.bucket,
        payload.fromPath,
        payload.toPath,
      );
    case 'remove':
      return removeObjects(storageBaseUrl, accessToken, payload.bucket, payload.paths);
    case 'removeFolder':
      return removeFolder(storageBaseUrl, accessToken, payload.bucket, payload.path);
    case 'createFolder':
      return createFolder(storageBaseUrl, accessToken, payload.bucket, payload.path);
    case 'folderStats':
      return folderStats(storageBaseUrl, accessToken, payload.bucket, payload.path);
    default: {
      const unknownOp = (payload as { op?: string }).op ?? 'unknown';
      throw new StorageHttpError(`Unknown storage operation: ${unknownOp}`, 400);
    }
  }
}
