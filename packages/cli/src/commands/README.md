# CLI Commands

This directory contains all CLI commands, each in its own file for better maintainability.

## Structure

Each command is a separate file that exports a command function:

- `start.js` - Start the ShellUI development server
- `build.js` - Build the ShellUI application for production

## Adding a New Command

1. Create a new file in this directory (e.g., `new-command.js`)
2. Export a function that implements the command logic:

```javascript
export async function newCommandCommand(args) {
  // Command implementation
}
```

3. Register it in `cli.js`:

```javascript
import { newCommandCommand } from './commands/index.js';

cli.command('new-command [args]', 'Description of the command').action(newCommandCommand);
```

4. Export it from `commands/index.js`:

```javascript
export { newCommandCommand } from './new-command.js';
```

## Available Commands

- **start** - Starts the development server
- **build** - Builds the application for production
