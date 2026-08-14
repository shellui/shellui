# Storage

Connect a [storage-service](https://github.com/shellui/storage-service) instance so the shell and admin panel can use object storage. When `storage.url` is set, signed-in users can open **Settings → Storage** to see the quota currently in use.

The Settings page is **only available when storage is configured**. It does not appear if `storage` is omitted, `storage.url` is empty, or you turn the page off with `showInSettings: false`.

## What ShellUI does in the UI

When `storage.url` is a non-empty string and `showInSettings` is not `false`:

- Adds **Settings → System → Storage** (`/__settings/storage`).
- Loads `GET {storage.url}/storage/v1/quota` with the signed-in user's access token.
- Shows personal usage and the organization quota.

When storage is not configured, or `showInSettings` is `false`, the Settings entry is omitted. Admin → Storage (files explorer, statistics) still follows `storage.url` / `storage.filesUrl` and is not affected by `showInSettings`.

Embedded apps do not call storage-service themselves for file operations. They use `shellui.storage` (same shape as [Supabase Storage](https://supabase.com/docs/guides/storage)); the SDK sends a message up to the root shell, which runs the request with `storage.url` and the signed-in user's token.

## Configuration

Add `storage` to `shellui.config.ts`:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  storage: {
    url: 'http://localhost:8001',
    filesUrl: 'http://localhost:5175/',
  },
};

export default config;
```

### Fields

| Field                    | Required | Description                                                                                       |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| `storage.url`            | yes      | Base URL of storage-service (trailing slashes are ignored).                                       |
| `storage.filesUrl`       | no       | Files explorer app URL used under Admin → Storage → Files.                                        |
| `storage.showInSettings` | no       | When `false`, hide Settings → Storage. Default: `true` (the page is shown whenever `url` is set). |

Types are defined as `StorageConfig` on `ShellUIConfig` in `@shellui/core`.

### Hide the Settings page

Use storage for Admin and the SDK file API without showing quota to end users:

```typescript
storage: {
  url: 'http://localhost:8001',
  filesUrl: 'http://localhost:5175/',
  showInSettings: false,
},
```

## How users open storage usage

Open the built-in settings route (default `/__settings`), then **System → Storage**.

The user must be signed in. The shell calls storage-service directly; it does not go through identity-service. Quota numbers come from `GET /storage/v1/quota` (company total and optional per-user cap).

Settings labels follow the active locale (`settings.routes.storage` in English and French).

## SDK file API

After `shellui.init()`, iframe apps upload, download, list, move, and rename files through `shellui.storage`. Methods return `{ data, error }` (they do not throw). Nested folders are path segments: `docs/reports/2024/q1.pdf`.

```javascript
import { shellui } from '@shellui/sdk';

await shellui.init();

const bucket = shellui.storage.from('company');

const { data: buckets, error: bucketsError } = await shellui.storage.listBuckets();
if (bucketsError) {
  console.error(bucketsError.message, bucketsError.status);
}

// Nested folders: create `docs/reports`, then upload inside it
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
  console.log('uploaded', uploaded.path);
}

const { data: entries, error: listError } = await bucket.list('docs/reports', {
  limit: 200,
  sortBy: { column: 'name', order: 'asc' },
});
if (!listError) {
  for (const item of entries) {
    // Folders have `id: null`; files have an object id
    console.log(item.id == null ? 'folder' : 'file', item.name);
  }
}

const { data: blob, error: downloadError } = await bucket.download('docs/reports/2024/q1.pdf');
if (!downloadError) {
  const url = URL.createObjectURL(blob);
  // …use url, then URL.revokeObjectURL(url)
}

await bucket.move('docs/reports/2024/q1.pdf', 'archive/2024/q1.pdf');
await bucket.rename('docs/old.txt', 'docs/new.txt');
await bucket.move('docs/reports', 'archive/reports', { folder: true });

await bucket.remove(['archive/2024/q1.pdf']);
await bucket.removeFolder('archive/reports');
```

### How messages reach the shell

1. The app calls `shellui.storage.from('company').upload(...)`.
2. The SDK posts `SHELLUI_STORAGE_REQUEST` to the parent window (including `File` / `Blob` payloads).
3. Nested iframes (for example Admin → Files) forward the message until it reaches the root shell.
4. Core handles the request with `storage.url` and the session access token, then replies with `SHELLUI_STORAGE_RESPONSE` to the originating frame.

The user must be signed in, and `storage.url` must be set. Otherwise the SDK returns `{ data: null, error }` with status `401` or `503`.

### Methods

| Call                                         | Purpose                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `shellui.storage.listBuckets()`              | List buckets the user can access                                           |
| `.from(bucket).list(prefix?, options?)`      | List files and folders at a prefix (`''` = root)                           |
| `.from(bucket).upload(path, file, options?)` | Upload. Nested path creates virtual folders. `{ upsert: true }` overwrites |
| `.from(bucket).download(path)`               | Download as a `Blob`                                                       |
| `.from(bucket).move(from, to, options?)`     | Move or rename a file. `{ folder: true }` moves a folder prefix            |
| `.from(bucket).rename(from, to, options?)`   | Alias of `move`                                                            |
| `.from(bucket).remove(paths)`                | Delete one or more files                                                   |
| `.from(bucket).createFolder(path)`           | Create a virtual folder (e.g. `docs/reports`)                              |
| `.from(bucket).removeFolder(path)`           | Delete every object under a folder prefix                                  |
| `.from(bucket).folderStats(path)`            | Count files under a prefix (for delete confirmation)                       |

Errors are `StorageError` objects with `message`, `status`, and optional `code`.

## Related guides

- [Administration panel](/features/administration) — Admin → Storage when `storage.url` is set
- [Authentication](/features/authentication) — session token used for quota and file requests
- [Application settings](/features/application-settings) — per-app panels under Settings
- [SDK](/sdk) — `shellui.storage` and `settings.storage` forwarded to trusted iframes
