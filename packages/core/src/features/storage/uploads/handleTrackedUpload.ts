import type { StorageRequestPayload, StorageResponsePayload } from '@shellui/sdk';
import { isFolderPlaceholderPath, StorageHttpError, uploadObjectWithProgress } from '../api';
import { handleStorageRequest, type HandleStorageRequestInput } from '../handleRequest';
import {
  addUpload,
  completeUpload,
  failUpload,
  isUploadSignalAborted,
  setUploadProgress,
} from './uploadQueue';

export function getUploadDisplayName(path: string, file: Blob): string {
  if (typeof File !== 'undefined' && file instanceof File && file.name) {
    return file.name;
  }
  const segment = path
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .pop();
  return segment || path;
}

function toErrorPayload(err: unknown): StorageResponsePayload['error'] {
  if (err instanceof StorageHttpError) {
    return { message: err.message, status: err.status, code: err.code };
  }
  return {
    message: err instanceof Error ? err.message : 'Request failed',
    status: 500,
  };
}

/**
 * Runs a storage upload with toaster progress. Folder placeholders skip the toast.
 * Uploads keep running at Shellui root regardless of route changes.
 */
export async function handleTrackedUpload(
  input: HandleStorageRequestInput,
): Promise<StorageResponsePayload> {
  const { storageUrl, accessToken, payload } = input;
  if (payload.op !== 'upload') {
    return handleStorageRequest(input);
  }

  if (isFolderPlaceholderPath(payload.path)) {
    return handleStorageRequest(input);
  }

  if (!storageUrl || !accessToken || !payload.id) {
    return handleStorageRequest(input);
  }

  const file = payload.file;
  const { id, signal } = addUpload({
    id: payload.id,
    name: getUploadDisplayName(payload.path, file),
    path: payload.path,
    bucket: payload.bucket,
    size: file.size || 0,
  });

  try {
    const data = await uploadObjectWithProgress(
      storageUrl,
      accessToken,
      payload.bucket,
      payload.path,
      file,
      {
        upsert: payload.upsert,
        contentType: payload.contentType,
        signal,
        onProgress: (loaded, total) => setUploadProgress(id, loaded, total),
      },
    );
    if (!isUploadSignalAborted(id, signal)) {
      completeUpload(id);
    }
    return { id: payload.id, data };
  } catch (err) {
    if (isUploadSignalAborted(id, signal)) {
      return {
        id: payload.id,
        error: { message: 'Upload cancelled', status: 499, code: 'cancelled' },
      };
    }
    const error = toErrorPayload(err);
    failUpload(id, error?.message || 'Upload failed');
    return { id: payload.id, error };
  }
}

export function isUploadPayload(
  payload: StorageRequestPayload | undefined,
): payload is Extract<StorageRequestPayload, { op: 'upload' }> {
  return payload?.op === 'upload';
}
