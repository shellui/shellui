import { normalizeStoragePath } from './paths.js';
import type { StorageTransport } from './transport.js';
import type {
  StorageBucket,
  StorageFileObject,
  StorageFolderMoveResult,
  StorageFolderStats,
  StorageListOptions,
  StorageMoveOptions,
  StorageResponse,
  StorageUploadOptions,
} from './types.js';

export class StorageBucketApi {
  constructor(
    private readonly bucket: string,
    private readonly transport: StorageTransport,
  ) {}

  /**
   * Upload a file. Nested folders are path segments (`docs/reports/q1.pdf`).
   * Existing objects return an error unless `{ upsert: true }`.
   */
  upload(
    path: string,
    file: Blob | File,
    options: StorageUploadOptions = {},
  ): Promise<StorageResponse<{ path: string }>> {
    const contentType =
      options.contentType || (file.type ? file.type : undefined) || 'application/octet-stream';
    return this.transport.request<{ path: string }>({
      op: 'upload',
      bucket: this.bucket,
      path: normalizeStoragePath(path),
      file,
      contentType,
      upsert: options.upsert,
    });
  }

  /** Download object bytes as a Blob. */
  download(path: string): Promise<StorageResponse<Blob>> {
    return this.transport.request<Blob>({
      op: 'download',
      bucket: this.bucket,
      path: normalizeStoragePath(path),
    });
  }

  /**
   * List files and folders at a prefix. Omit `path` (or pass `''`) for the bucket root.
   * Folders have `id: null`.
   */
  list(path = '', options: StorageListOptions = {}): Promise<StorageResponse<StorageFileObject[]>> {
    return this.transport.request<StorageFileObject[]>({
      op: 'list',
      bucket: this.bucket,
      prefix: normalizeStoragePath(path),
      options,
    });
  }

  /** Move or rename a file. Pass `{ folder: true }` to move a virtual folder prefix. */
  move(
    fromPath: string,
    toPath: string,
    options: StorageMoveOptions = {},
  ): Promise<StorageResponse<{ path: string } | StorageFolderMoveResult>> {
    return this.transport.request<{ path: string } | StorageFolderMoveResult>({
      op: 'move',
      bucket: this.bucket,
      fromPath: normalizeStoragePath(fromPath),
      toPath: normalizeStoragePath(toPath),
      folder: options.folder,
    });
  }

  /** Alias of `move`. */
  rename(
    fromPath: string,
    toPath: string,
    options: StorageMoveOptions = {},
  ): Promise<StorageResponse<{ path: string } | StorageFolderMoveResult>> {
    return this.move(fromPath, toPath, options);
  }

  /** Delete one or more files. */
  remove(paths: string[]): Promise<StorageResponse<{ path: string }[]>> {
    return this.transport.request<{ path: string }[]>({
      op: 'remove',
      bucket: this.bucket,
      paths: paths.map((path) => normalizeStoragePath(path)),
    });
  }

  /** Recursively delete every object under a folder prefix. */
  removeFolder(path: string): Promise<StorageResponse<{ count: number }>> {
    return this.transport.request<{ count: number }>({
      op: 'removeFolder',
      bucket: this.bucket,
      path: normalizeStoragePath(path),
    });
  }

  /** Create a virtual folder (nested paths allowed, e.g. `docs/reports`). */
  createFolder(path: string): Promise<StorageResponse<{ path: string }>> {
    return this.transport.request<{ path: string }>({
      op: 'createFolder',
      bucket: this.bucket,
      path: normalizeStoragePath(path),
    });
  }

  /** Count objects under a folder prefix (for delete confirmation). */
  folderStats(path: string): Promise<StorageResponse<StorageFolderStats>> {
    return this.transport.request<StorageFolderStats>({
      op: 'folderStats',
      bucket: this.bucket,
      path: normalizeStoragePath(path),
    });
  }
}

export class StorageClient {
  constructor(private readonly transport: StorageTransport) {}

  from(bucket: string): StorageBucketApi {
    return new StorageBucketApi(bucket, this.transport);
  }

  listBuckets(): Promise<StorageResponse<StorageBucket[]>> {
    return this.transport.request<StorageBucket[]>({ op: 'listBuckets' });
  }
}
