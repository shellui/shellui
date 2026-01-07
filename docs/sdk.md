# @shellui/sdk

ShellUI SDK - JavaScript SDK for ShellUI integration

## Installation

```bash
npm install @shellui/sdk
```

## Usage

```javascript
import { init, getVersion } from '@shellui/sdk';

const sdk = init({ /* config */ });
console.log(getVersion());
```

## API Reference

### init(config)

Initialize the ShellUI SDK with configuration.

**Parameters:**
- `config` (Object): Configuration options

**Returns:** SDK instance

### getVersion()

Get the current SDK version.

**Returns:** String version number


