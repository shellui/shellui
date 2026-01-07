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
shellui start [path/to/project]
shellui build [path/to/project]
```

## Commands

### start

Start the ShellUI development server

```bash
shellui start
shellui start ./my-project
```

### build

Build the ShellUI application for production

```bash
shellui build
shellui build ./my-project
```

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

cli
  .command('new-command [args]', 'Description')
  .action(newCommandCommand);
```

4. Export it from `src/commands/index.js`:

```javascript
export { newCommandCommand } from './new-command.js';
```


