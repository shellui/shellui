# ShellUI

> A lightweight microfrontend shell to ship apps faster.

ShellUI is a CLI tool that spins up a React-based microfrontend shell. It is powered by Vite and designed to be easily configurable.

## Features

- 🚀 **Fast**: Built on top of Vite for instant server start.
- ⚛️ **React-based**: The shell is a React application.
- ⚙️ **Configurable**: Loads configuration from `shellui.json` in your project root.
- 🔌 **Injectable Config**: Configuration is automatically injected into the shell application.

## Installation

```bash
npm install
```

## Usage

To start the ShellUI server, run:

```bash
npm start
```

Or run the CLI directly if installed globally or linked:

```bash
shellui start [path/to/project]
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

