---
title: Show a dialog
sidebar_label: Dialogs
description: Call shellui.dialog for host alert and confirm dialogs - modes, labels, size, and callbacks.
---

Alert dialogs are host chrome. Call `shellui.dialog` after `init`. On every viewport the dialog is geometrically centered with edge spacing and safe-area insets. Height hugs content.

```typescript
import { shellui } from "@shellui/sdk";

await shellui.init();

shellui.dialog({
  title: "Delete item",
  description: "This cannot be undone.",
  mode: "okCancel",
  onOk: () => {
    void deleteItem();
  },
  onCancel: () => {
    // no-op
  },
});
```

## Modes

| Mode | Buttons |
| --- | --- |
| `ok` | OK (default) |
| `okCancel` | OK and Cancel |
| `delete` | Destructive confirm styling |
| `confirm` | Generic confirm |
| `onlyCancel` | Cancel only |

Use specific labels (`Save`, `Discard`) instead of generic OK when the action is not obvious:

```typescript
shellui.dialog({
  title: "Save changes?",
  description: "You have unsaved edits.",
  mode: "okCancel",
  okLabel: "Save",
  cancelLabel: "Discard",
  secondaryButton: {
    label: "Keep editing",
    onClick: () => {
      // stay on the page
    },
  },
  onOk: () => {
    void saveChanges();
  },
  onCancel: () => {
    discardChanges();
  },
});
```

## Size, position, icon

- **`size`**: `'default'` (`max-w-lg`) or `'sm'` (`max-w-sm`)
- **`position`**: `'center'` (default) or `'bottom-left'`
- **`icon`**: string identifier; `'cookie'` is supported today (React nodes cannot be serialized)

Escape and backdrop click trigger the cancel path. Focus is trapped in the dialog and returned on close.

`dialog()` returns a `string` id when creating, and `void` when updating with `id`. Types: `DialogOptions` from `@shellui/sdk`.

Use [toasts](/features/toasts) for non-blocking status. Use [modals](/features/modals-drawers) when you need a full iframe, not a short prompt.
