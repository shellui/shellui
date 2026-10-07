# Quick Start Guide

## Installation

This repo uses pnpm. Install all dependencies:

```bash
pnpm install
```

## Development

### Run CLI locally

Since the CLI depends on `@shellui/core`, you can test it locally:

```bash
# Build all packages first
pnpm run build

# Link the CLI package
cd packages/cli
pnpm link --global

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
pnpm run build

# Core
cd packages/core
pnpm run build

# SDK
cd packages/sdk
pnpm run build
```

## Installing Packages

### Install CLI globally

```bash
npm install -g @shellui/cli@0.6.0
```

### Install as dev dependency

```bash
npm install --save-dev @shellui/cli@0.6.0
```

### Install Core or SDK

```bash
npm install @shellui/core@0.6.0
npm install @shellui/sdk@0.6.0
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
- `@shellui/core` depends on `@shellui/sdk`

These are linked in the workspace, so a change in `core` is available to the CLI, and a change in the SDK is available to core, during development.
