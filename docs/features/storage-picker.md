# Storage picker

Embedded apps can open a file or folder picker in a ShellUI modal. The user browses storage, keeps a selection while navigating, then confirms. The SDK returns serializable items — your app renders them however it wants.

The picker UI lives in the files app (`storage.filesUrl`). The root shell opens it in a dedicated modal so it can stack above Settings.

## Setup

Set `storage.url` and `storage.filesUrl` in `shellui.config.ts`:

```typescript
storage: {
  url: 'http://localhost:8001',
  filesUrl: 'http://localhost:5175/',
},
```

The user must be signed in.

## Pick folders

Folders only — files are hidden. Pass `{ multiple: true }` to allow more than one.

```javascript
import { shellui } from '@shellui/sdk';

await shellui.init();

const result = await shellui.selectFolders({ multiple: true });
if (!result) {
  // User cancelled
  return;
}

for (const folder of result.items) {
  console.log(folder.name, folder.path, folder.id);
}
```

## Pick files (and optionally folders)

```javascript
// Files only (folders are for navigation)
const files = await shellui.selectFiles({ multiple: true });

// Files and folders
const items = await shellui.selectFiles({ multiple: true, folders: true });
```

## What you get back

Each item looks like this:

```typescript
{
  id: string; // Stable id (survives rename)
  bucket: string;
  path: string; // Location at the time of selection
  name: string;
  type: 'file' | 'folder';
}
```

Keep `id` in your own data. After a folder or file is renamed, resolve the current path:

```javascript
const { data, error } = await shellui.storage.get(savedId);
if (data) {
  // data.path is the current location
}
```

`selectFolders` / `selectFiles` resolve to `null` when the user closes or cancels the modal. They throw if `storage.filesUrl` is missing.

## Messages

Apps do not need to post these themselves — the SDK methods above do.

| Type                            | Direction  | Payload                                                 |
| ------------------------------- | ---------- | ------------------------------------------------------- |
| `SHELLUI_SELECT_STORAGE`        | app → root | `{ id, multiple, mode: 'folders' \| 'files' \| 'any' }` |
| `SHELLUI_SELECT_STORAGE_RESULT` | root → app | `{ id, items? }` or `{ id, cancelled: true }`           |

## Try it

Settings → Advanced → enable developer features → Develop. The storage picker buttons open the same APIs and list selected names with a remove control.
