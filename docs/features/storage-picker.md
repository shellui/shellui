---
title: Pick files and folders
sidebar_label: Storage Picker
description: Open shellui.selectFolders or selectFiles so people using your app choose storage items in a host modal.
---

Embedded apps open a file or folder picker in a Shellui modal. The picker UI lives in the files app (`storage.filesUrl`). The root shell opens it in a dedicated modal so it can stack above Settings. You need `storage.url`, `storage.filesUrl`, and a signed-in session. See [Storage](/features/storage).

```json
{
  "storage": {
    "url": "http://localhost:8001",
    "filesUrl": "http://localhost:5175/"
  }
}
```

## Pick folders

Files are hidden. Pass `{ multiple: true }` for more than one folder.

```typescript
import { shellui } from "@shellui/sdk";

await shellui.init();

const result = await shellui.selectFolders({ multiple: true });
if (!result) {
  return;
}

for (const folder of result.items) {
  console.log(folder.name, folder.path, folder.id);
}
```

## Pick files

```typescript
const files = await shellui.selectFiles({ multiple: true });
const items = await shellui.selectFiles({ multiple: true, folders: true });
```

`selectFiles` without `folders: true` uses folders only for navigation. `folders: true` allows selecting files and folders (`mode: 'any'`).

## Result shape

```typescript
type StorageSelectedItem = {
  id: string;
  bucket: string;
  path: string;
  name: string;
  type: "file" | "folder";
};
```

Keep `id` in your data. After a rename, resolve the current path:

```typescript
const { data, error } = await shellui.storage.get(saved_item_id);
if (data) {
  console.log(data.path);
}
void error;
```

`selectFolders` / `selectFiles` resolve to `null` when the picker is closed or cancelled. They throw if `storage.filesUrl` is missing.

The SDK sends `SHELLUI_SELECT_STORAGE` (`{ id, multiple, mode: 'folders' | 'files' | 'any' }`) and waits for `SHELLUI_SELECT_STORAGE_RESULT`. You do not post these yourself.

Try the same APIs from **Settings → Advanced → developer features → Develop**.
