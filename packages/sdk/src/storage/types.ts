/**
 * Storage SDK types (Supabase-like `{ data, error }` client over postMessage).
 */

export class StorageError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = 'StorageError';
    this.status = status;
    this.code = code;
  }
}

export type StorageResponse<T> = {
  data: T | null;
  error: StorageError | null;
};

export type StorageListSortBy = {
  column: string;
  order: 'asc' | 'desc';
};

export type StorageListOptions = {
  limit?: number;
  offset?: number;
  sortBy?: StorageListSortBy;
};

export type StorageUploadOptions = {
  upsert?: boolean;
  contentType?: string;
};

export type StorageMoveOptions = {
  /** When true, move a virtual folder prefix (all nested objects). */
  folder?: boolean;
};

export type StorageObjectAccess = {
  audience?: string;
  readers?: string;
  writers?: string;
  owner_id?: number | null;
  shareable?: boolean;
  grants_enabled?: boolean;
  description?: string;
  can_write?: boolean;
  allowed_user_ids?: string[];
  allowed_group_ids?: string[];
  grant_count?: number;
};

export type StorageBucket = {
  id: string;
  name: string;
  display_name?: string;
  kind?: 'company' | 'user' | 'connector';
  public: boolean;
  access?: StorageObjectAccess;
  created_at?: string;
  connector_provider?: string | null;
};

/** Listed file or virtual folder (`id` is null for folders). */
export type StorageFileObject = {
  id: string | null;
  name: string;
  bucket_id?: string;
  /**
   * Stable folder id (placeholder object UUID) when `id` is null.
   * Survives rename; omit or null when the folder has no placeholder yet.
   */
  folder_id?: string | null;
  metadata: {
    size?: number;
    mimetype?: string;
    lastModified?: string;
  } | null;
  updated_at?: string | null;
  created_at?: string | null;
  access?: StorageObjectAccess;
};

/** Lookup result for `shellui.storage.get(id)` after a picker selection. */
export type StorageResolvedItem = {
  id: string;
  bucket: string;
  path: string;
  name: string;
  type: 'file' | 'folder';
};

export type StorageFolderStats = {
  prefix: string;
  object_count: number;
  file_count: number;
  placeholder_count: number;
  total_bytes: number;
};

export type StorageFolderMoveResult = {
  from: string;
  to: string;
  moved: number;
  grants_updated: number;
};

export type StorageOp =
  | 'listBuckets'
  | 'list'
  | 'upload'
  | 'download'
  | 'move'
  | 'remove'
  | 'removeFolder'
  | 'createFolder'
  | 'folderStats'
  | 'get';

export type StorageRequestPayload =
  | { id: string; op: 'listBuckets' }
  | {
      id: string;
      op: 'list';
      bucket: string;
      prefix?: string;
      options?: StorageListOptions;
    }
  | {
      id: string;
      op: 'upload';
      bucket: string;
      path: string;
      file: Blob;
      contentType?: string;
      upsert?: boolean;
    }
  | { id: string; op: 'download'; bucket: string; path: string }
  | {
      id: string;
      op: 'move';
      bucket: string;
      fromPath: string;
      toPath: string;
      folder?: boolean;
    }
  | { id: string; op: 'remove'; bucket: string; paths: string[] }
  | { id: string; op: 'removeFolder'; bucket: string; path: string }
  | { id: string; op: 'createFolder'; bucket: string; path: string }
  | { id: string; op: 'folderStats'; bucket: string; path: string }
  | { id: string; op: 'get'; objectId: string };

/** Request body before the SDK assigns `id`. Distributes over the union so `bucket` stays valid. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type StorageRequestInput = DistributiveOmit<StorageRequestPayload, 'id'>;

export type StorageErrorPayload = {
  message: string;
  status: number;
  code?: string;
};

export type StorageResponsePayload = {
  id: string;
  data?: unknown;
  error?: StorageErrorPayload;
};
