# Quick Start Guide

## Installation

Install all dependencies:

```bash
npm install
```

## Development

### Run CLI locally

Since the CLI depends on `@shellui/core`, you can test it locally:

```bash
# Build all packages first
npm run build

# Link the CLI package
cd packages/cli
npm link

# Now you can use shellui from anywhere
shellui start
```

Or use it directly:

```bash
node packages/cli/bin/shellui.js start
```

### Test individual packages

Each package can be developed independently:

```bash
# CLI
cd packages/cli
npm run build

# Core
cd packages/core
npm run build

# SDK
cd packages/sdk
npm run build
```

## Installing Packages

### Install CLI globally

```bash
npm install -g @shellui/cli
```

### Install as dev dependency

```bash
npm install --save-dev @shellui/cli
```

### Install Core or SDK

```bash
npm install @shellui/core
npm install @shellui/sdk
```

## Project Structure

```
.
├── packages/
│   ├── cli/              # CLI tool
│   │   ├── bin/          # Executable entry point
│   │   └── src/          # CLI source code
│   ├── core/             # Core React app
│   │   └── src/          # React app source
│   └── sdk/              # SDK package
│       └── src/          # SDK source code
├── package.json          # Root workspace config
└── README.md
```

## Workspace Dependencies

- `@shellui/cli` depends on `@shellui/core`
- `@shellui/sdk` depends on `@shellui/core`

These are automatically linked in the workspace, so changes to `core` are immediately available to `cli` and `sdk` during development.
