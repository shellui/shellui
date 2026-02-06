# @shellui/sdk

ShellUI SDK - JavaScript SDK for ShellUI integration

## Overview

The `@shellui/sdk` package provides a JavaScript SDK for programmatically integrating ShellUI into your applications. Most users will use ShellUI through the CLI, but the SDK is available for advanced use cases.

## When to Use

Use the SDK when you need to:

- Integrate ShellUI programmatically in your application
- Build custom tooling around ShellUI
- Access ShellUI functionality from JavaScript/TypeScript code

For most use cases, the CLI is the recommended approach.

## Installation

```bash
npm install @shellui/sdk
```

## Usage

### Basic Example

```javascript
import { init, getVersion } from '@shellui/sdk';

// Initialize the SDK
const sdk = init({
  port: 4000,
  title: 'My App',
  navigation: [
    {
      label: 'Home',
      path: 'home',
      url: 'http://localhost:4000/',
    },
  ],
});

// Get SDK version
console.log(getVersion());
```

## API Reference

### `init(config)`

Initialize the ShellUI SDK with configuration.

**Parameters:**

- `config` (Object): Configuration options
  - `port` (number, optional): Port number
  - `title` (string, optional): Application title
  - `navigation` (array, optional): Navigation items

**Returns:** SDK instance

**Example:**

```javascript
const sdk = init({
  port: 4000,
  title: 'My Application',
  navigation: [
    {
      label: 'Dashboard',
      path: 'dashboard',
      url: 'http://localhost:4000/',
      icon: 'Layout',
    },
  ],
});
```

### `getVersion()`

Get the current SDK version.

**Returns:** String version number

**Example:**

```javascript
import { getVersion } from '@shellui/sdk';
console.log(getVersion()); // e.g., "0.0.2"
```

## Integration Examples

### Programmatic Initialization

```javascript
import { init } from '@shellui/sdk';

const config = {
  port: process.env.PORT || 4000,
  title: process.env.APP_TITLE || 'ShellUI App',
  navigation: [
    // ... navigation items
  ],
};

const sdk = init(config);
```

### Dynamic Configuration

```javascript
import { init } from '@shellui/sdk';

async function loadConfig() {
  const response = await fetch('/api/config');
  const config = await response.json();
  return init(config);
}

const sdk = await loadConfig();
```

## CLI vs SDK

**Use the CLI when:**

- Building standard ShellUI applications
- You want the simplest setup
- You need development server and build tools

**Use the SDK when:**

- Building custom integrations
- You need programmatic control
- You're building tooling around ShellUI

For most users, the CLI is the recommended approach.
