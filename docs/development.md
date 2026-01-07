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

### Install dependencies

```bash
npm install
```

### Build all packages

```bash
npm run build
```

### Build individual packages

```bash
npm run build:cli
npm run build:core
npm run build:sdk
```

### Run tests

```bash
npm test
```

## Workspace Scripts

- `npm run build` - Build all packages
- `npm run build:cli` - Build CLI package
- `npm run build:core` - Build Core package
- `npm run build:sdk` - Build SDK package
- `npm run clean` - Clean all node_modules

## Workspace Dependencies

- `@shellui/cli` depends on `@shellui/core`
- `@shellui/sdk` depends on `@shellui/core`

These are automatically linked in the workspace, so changes to `core` are immediately available to `cli` and `sdk` during development.


