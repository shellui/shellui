# Storage

Connect a [storage-service](https://github.com/shellui/storage-service) instance so the shell and admin panel can use object storage. When `storage.url` is set, signed-in users can open **Settings → Storage** to see the quota currently in use.

The Settings page is **only available when storage is configured**. It does not appear if `storage` is omitted, `storage.url` is empty, or you turn the page off with `showInSettings: false`.

## What ShellUI does in the UI

When `storage.url` is a non-empty string and `showInSettings` is not `false`:

- Adds **Settings → System → Storage** (`/__settings/storage`).
- Loads `GET {storage.url}/storage/v1/quota` with the signed-in user's access token.
- Shows personal usage and the organization quota.

When storage is not configured, or `showInSettings` is `false`, the Settings entry is omitted. Admin → Storage (files explorer, statistics) still follows `storage.url` / `storage.filesUrl` and is not affected by `showInSettings`.

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

Use storage for Admin (or later upload / file-selector features) without showing quota to end users:

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

## Related guides

- [Administration panel](/features/administration) — Admin → Storage when `storage.url` is set
- [Authentication](/features/authentication) — session token used for the quota request
- [Application settings](/features/application-settings) — per-app panels under Settings
- [SDK](/sdk) — `settings.storage` forwarded to trusted iframes
