---
title: Show a toast
sidebar_label: Toasts
description: 'Call shellui.toast from an iframe so the host shows a toast - types, duration, position, and actions.'
---

Toasts are host chrome. Call `shellui.toast` after `init` so the shell renders them. Do not mount a second live region in the iframe.

```typescript
import { shellui } from '@shellui/sdk';

await shellui.init();

shellui.toast({
  title: 'Saved',
  description: 'Your changes are stored.',
  type: 'success',
});
```

## Types

`type` is `'default' | 'success' | 'error' | 'warning' | 'info' | 'loading'`. Loading toasts should be updated when the work finishes:

```typescript
const toastId = shellui.toast({
  title: 'Processing…',
  type: 'loading',
  duration: Infinity,
});

shellui.toast({
  id: toastId,
  title: 'Complete',
  type: 'success',
  duration: 3000,
});
```

Use the ellipsis character `…` in loading copy.

## Options

- **`id`**: reuse to update an existing toast
- **`title` / `description`**: title is the main line
- **`duration`**: milliseconds. `Infinity` stays until dismissed
- **`position`**: `'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'` (default `'bottom-right'`)
- **`action` / `cancel`**: `{ label, onClick }`

```typescript
shellui.toast({
  title: 'File uploaded',
  type: 'success',
  action: {
    label: 'View',
    onClick: () => {
      shellui.navigate('/files');
    },
  },
});
```

`toast()` returns a `string` id when creating a toast, and `void` when updating with `id`.

## Patterns

Submit with a loading toast, then swap to success or error on the same `id`. For undo, show a success toast whose `action` restores the item. Error toasts should include the next step (Retry, check the connection) - not only the failure.

Keep messages short. Match `type` to the outcome. Prefer [dialogs](/features/dialogs) when you need a blocking confirm.

Types: `ToastOptions` from `@shellui/sdk`.
