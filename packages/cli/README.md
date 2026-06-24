# @shellui/cli

ShellUI CLI - Command-line tool for ShellUI

## Installation

```bash
npm install -g @shellui/cli
```

Or install as a dev dependency:

```bash
npm install --save-dev @shellui/cli
```

## Usage

```bash
shellui dev [path/to/project] [--host] [--app]
shellui start [path/to/project] [--host] [--app]   # alias: dev
shellui build [path/to/project] [--app] [--bundles <targets>]
shellui init [path/to/project] [--force]
```

### Commands

- **dev** / **start** - Start the ShellUI development server

  ```bash
  shellui dev
  shellui dev ./my-project
  shellui dev --host      # listen on 0.0.0.0 for network access
  shellui dev --app       # desktop development (generates dist/app/)
  ```

- **build** - Build the ShellUI application for production

  ```bash
  shellui build
  shellui build ./my-project
  shellui build --app              # desktop app (.app on macOS)
  shellui build --app --bundles app,dmg   # + macOS DMG installer
  ```

- **init** - Create a `shellui.config.ts` boilerplate

  ```bash
  shellui init
  shellui init --force
  ```

See the ShellUI docs for [CLI](https://docs.shellui.com/cli) and [Tauri](https://docs.shellui.com/tauri) details.

## Project Structure

The CLI is organized for maintainability with a clear separation of concerns:

```
src/
├── cli.js              # Main CLI orchestrator
├── commands/           # All commands in separate files
│   ├── index.js       # Command registry
│   ├── start.js       # Start command implementation
│   └── build.js       # Build command implementation
└── utils/             # Utility functions
    ├── index.js       # Utilities export
    ├── config.js      # Configuration loading
    └── vite.js        # Vite-specific utilities
```

## Development

### Adding a New Command

1. Create a new file in `src/commands/` (e.g., `new-command.js`)
2. Export a command function:

```javascript
export async function newCommandCommand(args) {
  // Command implementation
}
```

3. Register it in `src/cli.js`:

```javascript
import { newCommandCommand } from './commands/index.js';

cli.command('new-command [args]', 'Description').action(newCommandCommand);
```

4. Export it from `src/commands/index.js`:

```javascript
export { newCommandCommand } from './new-command.js';
```

See `src/commands/README.md` for more details.

## License

MIT
