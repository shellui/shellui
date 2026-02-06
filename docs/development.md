# Development Guide

Guide for developing ShellUI packages.

## Project Structure

```
.
├── packages/
│   ├── cli/          # CLI package
│   ├── core/          # Core React app
│   └── sdk/           # SDK package
└── package.json       # Root workspace configuration
```

## Development Workflow

### Prerequisites

This project uses [pnpm](https://pnpm.io/) as its package manager. Install it globally if you haven't already:

```bash
npm install -g pnpm
```

### Install dependencies

```bash
pnpm install
```

### Build all packages

```bash
pnpm run build
```

### Build individual packages

```bash
pnpm run build:cli
pnpm run build:core
pnpm run build:sdk
```

### Run tests

```bash
pnpm test
```

## Workspace Scripts

- `pnpm run build` - Build all packages
- `pnpm run build:cli` - Build CLI package
- `pnpm run build:core` - Build Core package
- `pnpm run build:sdk` - Build SDK package
- `pnpm run clean` - Clean all node_modules

## Workspace Dependencies

- `@shellui/cli` depends on `@shellui/core`
- `@shellui/sdk` depends on `@shellui/core`

These are automatically linked in the workspace, so changes to `core` are immediately available to `cli` and `sdk` during development.
