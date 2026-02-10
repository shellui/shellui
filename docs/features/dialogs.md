# Alert Dialogs

ShellUI provides alert dialogs through the SDK for displaying important messages, confirmations, and user prompts with various button configurations.

## Basic Usage

Import and use the dialog function from the ShellUI SDK:

```javascript
import { shellui } from '@shellui/sdk';

// Initialize the SDK first
await shellui.init();

// Show a simple dialog
shellui.dialog({
  title: 'Confirm Action',
  description: 'Are you sure you want to proceed?',
  mode: 'okCancel',
  onOk: () => {
    console.log('User confirmed');
  },
  onCancel: () => {
    console.log('User cancelled');
  },
});
```

## Dialog Modes

ShellUI supports different dialog modes for various use cases:

### OK Only

Simple informational dialog with a single OK button:

```javascript
shellui.dialog({
  title: 'Information',
  description: 'This is an informational message.',
  mode: 'ok',
  onOk: () => {
    console.log('OK clicked');
  },
});
```

### OK Cancel

Confirmation dialog with OK and Cancel buttons:

```javascript
shellui.dialog({
  title: 'Confirm Delete',
  description: 'Are you sure you want to delete this item?',
  mode: 'okCancel',
  onOk: () => {
    console.log('Confirmed');
    // Perform delete action
  },
  onCancel: () => {
    console.log('Cancelled');
  },
});
```

### Delete Confirmation

Special delete mode with destructive styling:

```javascript
shellui.dialog({
  title: 'Delete Item',
  description: 'This action cannot be undone.',
  mode: 'delete',
  onOk: () => {
    console.log('Delete confirmed');
    // Perform delete
  },
  onCancel: () => {
    console.log('Delete cancelled');
  },
});
```

### Confirm Mode

Generic confirmation dialog:

```javascript
shellui.dialog({
  title: 'Confirm Action',
  description: 'Do you want to continue?',
  mode: 'confirm',
  onOk: () => {
    console.log('Confirmed');
  },
  onCancel: () => {
    console.log('Cancelled');
  },
});
```

### Only Cancel

Dialog with only a Cancel button (useful for informational dialogs):

```javascript
shellui.dialog({
  title: 'Notice',
  description: 'This is a notice that requires acknowledgment.',
  mode: 'onlyCancel',
  onCancel: () => {
    console.log('Acknowledged');
  },
});
```

## Custom Button Labels

Customize button labels:

```javascript
shellui.dialog({
  title: 'Save Changes?',
  description: 'You have unsaved changes.',
  mode: 'okCancel',
  okLabel: 'Save',
  cancelLabel: 'Discard',
  onOk: () => {
    saveChanges();
  },
  onCancel: () => {
    discardChanges();
  },
});
```

## Dialog Sizes

Control dialog size:

```javascript
// Default size (max-w-lg)
shellui.dialog({
  title: 'Default Size',
  description: 'This is the default dialog size.',
  size: 'default',
});

// Small size (max-w-sm)
shellui.dialog({
  title: 'Small Dialog',
  description: 'This is a smaller dialog.',
  size: 'sm',
});
```

## Dialog Positions

Control dialog position:

```javascript
// Center position (default)
shellui.dialog({
  title: 'Centered Dialog',
  description: 'This dialog appears in the center.',
  position: 'center',
});

// Bottom-left position
shellui.dialog({
  title: 'Bottom Dialog',
  description: 'This dialog appears at the bottom-left.',
  position: 'bottom-left',
});
```

## Secondary Button

Add a secondary action button:

```javascript
shellui.dialog({
  title: 'Save Changes?',
  description: 'You have unsaved changes.',
  mode: 'okCancel',
  okLabel: 'Save',
  cancelLabel: 'Cancel',
  secondaryButton: {
    label: 'Save As...',
    onClick: () => {
      console.log('Save as clicked');
      // Open save as dialog
    },
  },
  onOk: () => {
    saveChanges();
  },
  onCancel: () => {
    discardChanges();
  },
});
```

## Icons

Add icons to dialogs (currently supports 'cookie' icon):

```javascript
shellui.dialog({
  title: 'Cookie Consent',
  description: 'We use cookies to improve your experience.',
  mode: 'okCancel',
  icon: 'cookie',
  onOk: () => {
    acceptCookies();
  },
});
```

## Complete Examples

### Delete Confirmation

```javascript
function deleteItem(itemId) {
  shellui.dialog({
    title: 'Delete Item',
    description: 'This action cannot be undone. Are you sure you want to delete this item?',
    mode: 'delete',
    onOk: async () => {
      try {
        await api.deleteItem(itemId);
        shellui.toast({
          title: 'Item deleted',
          type: 'success',
        });
      } catch (error) {
        shellui.toast({
          title: 'Failed to delete',
          description: error.message,
          type: 'error',
        });
      }
    },
    onCancel: () => {
      // User cancelled, no action needed
    },
  });
}
```

### Unsaved Changes Warning

```javascript
function handleNavigation() {
  if (hasUnsavedChanges()) {
    shellui.dialog({
      title: 'Unsaved Changes',
      description: 'You have unsaved changes. What would you like to do?',
      mode: 'okCancel',
      okLabel: 'Save',
      cancelLabel: 'Discard',
      secondaryButton: {
        label: 'Cancel',
        onClick: () => {
          // Stay on current page
        },
      },
      onOk: async () => {
        await saveChanges();
        navigate();
      },
      onCancel: () => {
        discardChanges();
        navigate();
      },
    });
  } else {
    navigate();
  }
}
```

### Form Validation Error

```javascript
function validateAndSubmit(formData) {
  const errors = validateForm(formData);

  if (errors.length > 0) {
    shellui.dialog({
      title: 'Validation Error',
      description: `Please fix the following errors:\n${errors.join('\n')}`,
      mode: 'ok',
      okLabel: 'OK',
      onOk: () => {
        // Focus first error field
        focusFirstError();
      },
    });
    return;
  }

  submitForm(formData);
}
```

### Information Dialog

```javascript
function showInfo() {
  shellui.dialog({
    title: 'New Features Available',
    description: "We've added new features! Check out the changelog for details.",
    mode: 'ok',
    okLabel: 'Got it',
    onOk: () => {
      // User acknowledged
    },
  });
}
```

## Dialog Behavior

- **Modal**: Dialogs are modal - they block interaction with the rest of the app
- **Escape Key**: Users can close dialogs by pressing Escape (triggers cancel callback)
- **Click Outside**: Clicking outside the dialog closes it (triggers cancel callback)
- **Focus Management**: Dialogs automatically manage focus for accessibility

## Best Practices

1. **Use appropriate modes**: Choose the right mode for your use case
   - Use `ok` for informational messages
   - Use `okCancel` for confirmations
   - Use `delete` for destructive actions
2. **Clear messages**: Write clear, concise titles and descriptions
3. **Meaningful labels**: Use descriptive button labels (e.g., "Save" instead of "OK")
4. **Handle all callbacks**: Always provide handlers for all button callbacks
5. **Don't overuse**: Dialogs interrupt user flow - use sparingly
6. **Consider alternatives**: For less critical messages, consider using toasts instead

## Dialog API Reference

### `dialog(options?: DialogOptions): string | void`

Shows an alert dialog.

**Parameters:**

- `options` (DialogOptions, optional):
  - `id` (string, optional): Dialog ID for updating existing dialogs
  - `title` (string, required): Dialog title
  - `description` (string, optional): Dialog description/message
  - `mode` ('ok' | 'okCancel' | 'delete' | 'confirm' | 'onlyCancel', optional): Dialog mode (default: 'ok')
  - `okLabel` (string, optional): OK button label
  - `cancelLabel` (string, optional): Cancel button label
  - `size` ('default' | 'sm', optional): Dialog size (default: 'default')
  - `position` ('center' | 'bottom-left', optional): Dialog position (default: 'center')
  - `secondaryButton` (object, optional): Secondary button configuration
    - `label` (string): Button label
    - `onClick` (function): Click handler
  - `icon` (string, optional): Icon identifier (e.g., 'cookie')
  - `onOk` (function, optional): OK button click handler
  - `onCancel` (function, optional): Cancel button click handler

**Returns:**

- `string`: Dialog ID when creating a new dialog
- `void`: When updating an existing dialog (with `id`)

## Related Guides

- [Toast Notifications](/features/toasts) - For less critical messages
- [SDK Integration](/sdk) - Learn about the ShellUI SDK
