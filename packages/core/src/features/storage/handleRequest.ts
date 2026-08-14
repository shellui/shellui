import type {
  StorageErrorPayload,
  StorageRequestPayload,
  StorageResponsePayload,
} from '@shellui/sdk';
import { executeStorageOp, StorageHttpError } from './api';

export type HandleStorageRequestInput = {
  storageUrl: string | null;
  accessToken: string | null;
  payload: StorageRequestPayload;
};

export async function handleStorageRequest({
  storageUrl,
  accessToken,
  payload,
}: HandleStorageRequestInput): Promise<StorageResponsePayload> {
  if (!payload?.id || !payload.op) {
    return {
      id: payload?.id ?? '',
      error: { message: 'Invalid storage request', status: 400 },
    };
  }

  if (!storageUrl) {
    return {
      id: payload.id,
      error: { message: 'Storage is not configured', status: 503 },
    };
  }

  if (!accessToken) {
    return {
      id: payload.id,
      error: { message: 'Not authenticated', status: 401 },
    };
  }

  try {
    const data = await executeStorageOp(storageUrl, accessToken, payload);
    return { id: payload.id, data };
  } catch (err) {
    const error: StorageErrorPayload =
      err instanceof StorageHttpError
        ? { message: err.message, status: err.status, code: err.code }
        : {
            message: err instanceof Error ? err.message : 'Request failed',
            status: 500,
          };
    return { id: payload.id, error };
  }
}
