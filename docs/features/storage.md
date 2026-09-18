---
title: Connect object storage
sidebar_label: Storage
description: 'Set storage.url for Settings quota, Admin files, and shellui.storage from iframe apps.'
---

Connect a [storage-service](https://github.com/shellui/storage-service) instance so the shell can show quota and proxy file APIs. Embedded apps must not call storage-service themselves for uploads; they use `shellui.storage`, and the root shell runs the request with `storage.url` and the signed-in user's token.

Settings → Storage appears only when `storage.url` is a non-empty string and `showInSettings` is not `false`. Admin → Storage still follows `storage.url` / `storage.filesUrl` and ignores `showInSettings`.

## Configuration

```json
{
  "storage": {
    "url": "http://localhost:8001",
    "filesUrl": "http://localhost:5175/"
  }
}
```

| Field                    | Required                  | Description                                                        |
| ------------------------ | ------------------------- | ------------------------------------------------------------------ |
| `storage.url`            | yes when `storage` is set | storage-service base URL (trailing slashes ignored)                |
| `storage.filesUrl`       | no                        | Files explorer URL for Admin → Storage → Files                     |
| `storage.showInSettings` | no                        | `false` hides Settings → Storage. Default `true` when `url` is set |

Type: `StorageConfig` on `ShellUIConfig`. Hide quota for end users while keeping Admin and the SDK:

```json
{
  "storage": {
    "url": "http://localhost:8001",
    "filesUrl": "http://localhost:5175/",
    "showInSettings": false
  }
}
```

Signed-in users open `/__settings`, then **System → Storage**. The shell calls `GET {storage.url}/storage/v1/quota` with the access token (not through identity-service). Labels follow the active locale (`settings.routes.storage`).

## SDK file API

After `shellui.init()`, methods return `{ data, error }` (they do not throw). Nested folders are path segments: `docs/reports/2024/q1.pdf`.

```typescript
import { shellui } from '@shellui/sdk';

await shellui.init();

const bucket = shellui.storage.from('company');

const { data: buckets, error: bucketsError } = await shellui.storage.listBuckets();
if (bucketsError) {
  console.error(bucketsError.message, bucketsError.status);
}

const { error: folderError } = await bucket.createFolder('docs/reports');
if (folderError) {
  console.error(folderError.message);
}

const file = new File(['quarter one'], 'q1.pdf', { type: 'application/pdf' });
const { data: uploaded, error: uploadError } = await bucket.upload(
  'docs/reports/2024/q1.pdf',
  file,
  { upsert: true },
);
if (uploadError) {
  console.error(uploadError.message);
} else {
  console.log('uploaded', uploaded?.path);
}

const { data: entries, error: listError } = await bucket.list('docs/reports', {
  limit: 200,
  sortBy: { column: 'name', order: 'asc' },
});
if (!listError && entries) {
  for (const item of entries) {
    console.log(item.id == null ? 'folder' : 'file', item.name);
  }
}

const { data: blob, error: downloadError } = await bucket.download('docs/reports/2024/q1.pdf');
if (!downloadError && blob) {
  const url = URL.createObjectURL(blob);
  URL.revokeObjectURL(url);
}

await bucket.move('docs/reports/2024/q1.pdf', 'archive/2024/q1.pdf');
await bucket.rename('docs/old.txt', 'docs/new.txt');
await bucket.move('docs/reports', 'archive/reports', { folder: true });
await bucket.remove(['archive/2024/q1.pdf']);
await bucket.removeFolder('archive/reports');
```

The SDK posts `SHELLUI_STORAGE_REQUEST` (including `File` / `Blob`) to the parent. Nested iframes forward until the root shell replies with `SHELLUI_STORAGE_RESPONSE`. The root **StorageBridge** only honors requests from registered iframe companions that pass the same trusted-frame policy as session JWT sharing (navigation companions with `safeForAuthToken: true`, admin URLs, and `storage.filesUrl`). Untrusted or unregistered senders get `{ data: null, error }` with status `403` and no storage I/O. Unsigned-in callers or missing `storage.url` get status `401` or `503`.

| Call                                         | Purpose                                         |
| -------------------------------------------- | ----------------------------------------------- |
| `shellui.storage.listBuckets()`              | List accessible buckets                         |
| `.from(bucket).list(prefix?, options?)`      | List at a prefix (`''` = root)                  |
| `.from(bucket).upload(path, file, options?)` | Upload; `{ upsert: true }` overwrites           |
| `.from(bucket).download(path)`               | Download as a `Blob`                            |
| `.from(bucket).move(from, to, options?)`     | Move or rename; `{ folder: true }` for a prefix |
| `.from(bucket).rename(from, to, options?)`   | Alias of `move`                                 |
| `.from(bucket).remove(paths)`                | Delete files                                    |
| `.from(bucket).createFolder(path)`           | Create a virtual folder                         |
| `.from(bucket).removeFolder(path)`           | Delete every object under a prefix              |
| `.from(bucket).folderStats(path)`            | Count files (delete confirmation)               |
| `shellui.storage.get(id)`                    | Resolve a picker `id` to the current path       |

Errors are `StorageError` with `message`, `status`, and optional `code`. To pick files in a modal, see [Storage picker](/features/storage-picker). The API shape matches [Supabase Storage](https://supabase.com/docs/guides/storage) where listed.

## Related pages

- [Administration](/features/administration), [Authentication](/features/authentication), [SDK](/sdk)
