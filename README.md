# ShellUI

> A lightweight microfrontend shell to ship apps faster.

[![npm version](https://img.shields.io/npm/v/@shellui/cli.svg)](https://www.npmjs.com/package/@shellui/cli)

ShellUI is a CLI tool that spins up a React-based microfrontend shell. It is powered by Vite and designed to be easily configurable.

**Available on npm**: Install with `npm install @shellui/cli` or use `npx @shellui/cli` to get started quickly.

## Features

- 🚀 **Fast**: Built on top of Vite for instant server start.
- ⚛️ **React-based**: The shell is a React application.
- ⚙️ **Configurable**: Loads configuration from `shellui.json` in your project root.
- 🔌 **Injectable Config**: Configuration is automatically injected into the shell application.

## Installation

ShellUI is available on npm. Install it globally:

```bash
npm install -g @shellui/cli
```

Or install it as a dev dependency in your project:

```bash
npm install --save-dev @shellui/cli
```

You can also use it directly with `npx` without installing:

```bash
npx shellui start
```

## Usage

After installation, you can use the `shellui` command directly:

```bash
npx shellui start [path/to/project]
```

Or if installed globally:

```bash
shellui start [path/to/project]
```

You can also use it via npm scripts in your `package.json`:

```json
{
  "scripts": {
    "start": "shellui start",
    "build": "shellui build"
  }
}
```

By default, it looks for configuration in the current directory.

## Configuration

ShellUI looks for a `shellui.json` file in your project root.

**Example `shellui.json`:**

```json
{
  "port": 4000
}
```

- **port**: The port number to start the server on (default: `3000`).

## Development

This repository contains the core logic for the shell.

- `bin/shellui.js`: The CLI entry point.
- `src/cli.js`: Main CLI logic using `cac` and `vite`.
- `src/app.jsx`: The shell's React application entry point.

## License

MIT

