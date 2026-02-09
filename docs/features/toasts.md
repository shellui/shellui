# Toast Notifications

ShellUI provides a toast notification system through the SDK, allowing you to display temporary messages to users with various styles and actions.

## Basic Usage

Import and use the toast function from the ShellUI SDK:

```javascript
import { shellui } from '@shellui/sdk';

// Initialize the SDK first
await shellui.init();

// Show a simple toast
shellui.toast({
  title: 'Hello World',
  description: 'This is a toast notification',
});
```

## Toast Types

ShellUI supports multiple toast types for different use cases:

### Success Toast

```javascript
shellui.toast({
  title: 'Success!',
  description: 'Your changes have been saved.',
  type: 'success',
});
```

### Error Toast

```javascript
shellui.toast({
  title: 'Error',
  description: 'Something went wrong. Please try again.',
  type: 'error',
});
```

### Warning Toast

```javascript
shellui.toast({
  title: 'Warning',
  description: 'This action cannot be undone.',
  type: 'warning',
});
```

### Info Toast

```javascript
shellui.toast({
  title: 'Information',
  description: 'New features are available.',
  type: 'info',
});
```

### Loading Toast

```javascript
const toastId = shellui.toast({
  title: 'Processing...',
  description: 'Please wait while we process your request.',
  type: 'loading',
});

// Update to success when done
shellui.toast({
  id: toastId,
  title: 'Complete!',
  description: 'Your request has been processed.',
  type: 'success',
});
```

### Default Toast

```javascript
shellui.toast({
  title: 'Notification',
  description: 'This is a default toast.',
  type: 'default', // Optional, this is the default
});
```

## Toast Options

### Title and Description

```javascript
shellui.toast({
  title: 'Toast Title',        // Required: Main message
  description: 'Optional description text', // Optional: Additional details
});
```

### Duration

Control how long the toast is displayed (in milliseconds):

```javascript
shellui.toast({
  title: 'Quick Message',
  description: 'This disappears quickly',
  duration: 2000, // 2 seconds (default is usually longer)
});

shellui.toast({
  title: 'Persistent Message',
  description: 'This stays until dismissed',
  duration: Infinity, // Never auto-dismiss
});
```

### Position

Control where toasts appear on screen:

```javascript
shellui.toast({
  title: 'Top Left',
  position: 'top-left',
});

shellui.toast({
  title: 'Top Center',
  position: 'top-center',
});

shellui.toast({
  title: 'Top Right',
  position: 'top-right',
});

shellui.toast({
  title: 'Bottom Left',
  position: 'bottom-left',
});

shellui.toast({
  title: 'Bottom Center',
  position: 'bottom-center',
});

shellui.toast({
  title: 'Bottom Right',
  position: 'bottom-right', // Default
});
```

## Toast Actions

Add action buttons to toasts:

### Action Button

```javascript
shellui.toast({
  title: 'File uploaded',
  description: 'Your file has been uploaded successfully.',
  type: 'success',
  action: {
    label: 'View',
    onClick: () => {
      console.log('View clicked');
      // Navigate to file or perform action
    },
  },
});
```

### Cancel Button

```javascript
shellui.toast({
  title: 'Undo action?',
  description: 'You can undo this action.',
  cancel: {
    label: 'Undo',
    onClick: () => {
      console.log('Undo clicked');
      // Undo the action
    },
  },
});
```

### Both Action and Cancel

```javascript
shellui.toast({
  title: 'Delete item?',
  description: 'This action cannot be undone.',
  type: 'warning',
  action: {
    label: 'Delete',
    onClick: () => {
      console.log('Delete confirmed');
      // Delete the item
    },
  },
  cancel: {
    label: 'Cancel',
    onClick: () => {
      console.log('Cancelled');
      // Cancel the action
    },
  },
});
```

## Updating Toasts

Update an existing toast by providing its ID:

```javascript
// Create a loading toast
const toastId = shellui.toast({
  title: 'Uploading...',
  type: 'loading',
  duration: Infinity, // Don't auto-dismiss
});

// Simulate upload
setTimeout(() => {
  // Update to success
  shellui.toast({
    id: toastId,
    title: 'Upload complete!',
    type: 'success',
    duration: 3000,
  });
}, 2000);
```

## Complete Examples

### Form Submission

```javascript
async function submitForm(data) {
  const toastId = shellui.toast({
    title: 'Submitting...',
    type: 'loading',
    duration: Infinity,
  });

  try {
    await api.submitForm(data);
    shellui.toast({
      id: toastId,
      title: 'Success!',
      description: 'Your form has been submitted.',
      type: 'success',
    });
  } catch (error) {
    shellui.toast({
      id: toastId,
      title: 'Error',
      description: 'Failed to submit form. Please try again.',
      type: 'error',
    });
  }
}
```

### Undo Action

```javascript
function deleteItem(itemId) {
  // Perform deletion
  deleteItemFromDatabase(itemId);

  // Show undo toast
  shellui.toast({
    title: 'Item deleted',
    description: 'The item has been removed.',
    type: 'success',
    action: {
      label: 'Undo',
      onClick: () => {
        restoreItem(itemId);
        shellui.toast({
          title: 'Item restored',
          type: 'success',
        });
      },
    },
  });
}
```

### Error Handling

```javascript
async function fetchData() {
  try {
    const data = await api.getData();
    return data;
  } catch (error) {
    shellui.toast({
      title: 'Failed to load data',
      description: error.message || 'Please check your connection and try again.',
      type: 'error',
      duration: 5000,
      action: {
        label: 'Retry',
        onClick: () => {
          fetchData(); // Retry the operation
        },
      },
    });
    throw error;
  }
}
```

## Best Practices

1. **Use appropriate types**: Match toast types to the message (success for success, error for errors, etc.)
2. **Keep messages concise**: Toast notifications should be brief and actionable
3. **Provide actions**: Add action buttons when users can take immediate action
4. **Update loading toasts**: Convert loading toasts to success/error when operations complete
5. **Don't overuse**: Avoid showing too many toasts at once
6. **Consider duration**: Use longer durations for important messages, shorter for quick confirmations

## Toast API Reference

### `toast(options?: ToastOptions): string | void`

Shows or updates a toast notification.

**Parameters:**
- `options` (ToastOptions, optional):
  - `id` (string, optional): Toast ID for updating existing toasts
  - `title` (string, optional): Toast title/message
  - `description` (string, optional): Additional description text
  - `type` ('default' | 'success' | 'error' | 'warning' | 'info' | 'loading', optional): Toast type
  - `duration` (number, optional): Display duration in milliseconds
  - `position` ('top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right', optional): Toast position
  - `action` (object, optional): Action button configuration
    - `label` (string): Button label
    - `onClick` (function): Click handler
  - `cancel` (object, optional): Cancel button configuration
    - `label` (string): Button label
    - `onClick` (function): Click handler

**Returns:**
- `string`: Toast ID when creating a new toast
- `void`: When updating an existing toast (with `id`)

## Related Guides

- [Alert Dialogs](/features/dialogs) - For more prominent confirmations
- [SDK Integration](/sdk) - Learn about the ShellUI SDK
