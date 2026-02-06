# @shellui/core

ShellUI Core - Core React application runtime

## Overview

The `@shellui/core` package provides the React application runtime for ShellUI. It's automatically included when you use the ShellUI CLI, so you typically don't need to install it separately.

## When to Use

Most users will interact with `@shellui/core` indirectly through the CLI. However, you might need to reference it directly if you're:

- Creating custom TypeScript configuration files (for type definitions)
- Integrating ShellUI programmatically
- Extending ShellUI functionality

## Type Definitions

If you're using TypeScript configuration files (`shellui.config.ts`), you can import types from `@shellui/core`:

```typescript
import type { ShellUIConfig, NavigationItem } from '@shellui/core';

const config: ShellUIConfig = {
  // ... your configuration
};
```

## Installation

The core package is automatically managed by the CLI. If you need to install it directly:

```bash
npm install @shellui/core
```

## Features

- React-based microfrontend shell
- TypeScript type definitions
- Development and production builds
- Hot module replacement support

## API Reference

### Types

#### `ShellUIConfig`

Main configuration interface:

```typescript
interface ShellUIConfig {
  port?: number;
  title?: string;
  navigation?: NavigationItem[];
}
```

#### `NavigationItem`

Navigation item interface:

```typescript
interface NavigationItem {
  label: string;
  path: string;
  url: string;
  icon?: string;
}
```

## For Developers

If you're contributing to ShellUI or need to build the core package:

```bash
cd packages/core
npm run build
```
