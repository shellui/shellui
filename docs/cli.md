# ShellUI CLI

The ShellUI CLI is the command-line tool for developing and building ShellUI applications.

## Installation

See the [Installation Guide](/installation) for detailed installation instructions.

## Commands

### `shellui start [root]`

Start the ShellUI development server.

**Usage:**

```bash
shellui start
shellui start ./my-project
```

**Description:**

- Starts a Vite development server with hot module replacement
- Automatically opens your browser (on first start)
- Watches for configuration file changes and restarts automatically
- Uses the port specified in your configuration (default: 3000)

**Options:**

- `root` (optional): Project root directory (default: current directory)

**Example:**

```bash
# Start server in current directory
shellui start

# Start server in specific directory
shellui start ./my-app
```

### `shellui build [root]`

Build the ShellUI application for production.

**Usage:**

```bash
shellui build
shellui build ./my-project
```

**Description:**

- Builds your ShellUI application for production
- Outputs optimized files to the `dist/` directory
- Minifies and optimizes assets
- Creates a production-ready static site

**Options:**

- `root` (optional): Project root directory (default: current directory)

**Example:**

```bash
# Build in current directory
shellui build

# Build specific project
shellui build ./my-app
```

## Configuration

ShellUI uses a configuration file to customize your application. The CLI looks for configuration files in your project root:

- `shellui.config.json` (JSON format)
- `shellui.config.ts` (TypeScript format)

TypeScript configuration files are preferred if you want type checking and IntelliSense support.

### Configuration File Location

The CLI searches for configuration files in this order:

1. The specified `root` directory (if provided)
2. The current working directory

### Configuration Options

#### `port` (number, optional)

Port number for the development server.

```json
{
  "port": 4000
}
```

**Default:** `3000`

#### `title` (string, optional)

Application title displayed in the UI.

```json
{
  "title": "My Application"
}
```

#### `navigation` (array, optional)

Array of navigation items for the sidebar.

```json
{
  "navigation": [
    {
      "label": "Home",
      "path": "home",
      "url": "http://localhost:4000/",
      "icon": "Home"
    }
  ]
}
```

**Navigation Item Properties:**

- `label` (string, required): Display text for the navigation item
- `path` (string, required): Unique path identifier
- `url` (string, required): URL to navigate to when clicked
- `icon` (string, optional): Icon name (e.g., "Home", "BookOpen", "User")

### Example Configuration

**JSON (`shellui.config.json`):**

```json
{
  "port": 4000,
  "title": "My ShellUI App",
  "navigation": [
    {
      "label": "Documentation",
      "path": "docs",
      "url": "https://docs.example.com/",
      "icon": "BookOpen"
    },
    {
      "label": "Dashboard",
      "path": "dashboard",
      "url": "http://localhost:4000/",
      "icon": "Layout"
    },
    {
      "label": "Settings",
      "path": "settings",
      "url": "https://app.example.com/settings",
      "icon": "Settings"
    }
  ]
}
```

**TypeScript (`shellui.config.ts`):**

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'My ShellUI App',
  navigation: [
    {
      label: 'Documentation',
      path: 'docs',
      url: 'https://docs.example.com/',
      icon: 'BookOpen',
    },
    {
      label: 'Dashboard',
      path: 'dashboard',
      url: 'http://localhost:4000/',
      icon: 'Layout',
    },
    {
      label: 'Settings',
      path: 'settings',
      url: 'https://app.example.com/settings',
      icon: 'Settings',
    },
  ],
};

export default config;
```

### Configuration File Watching

When you run `shellui start`, the CLI automatically watches your configuration file for changes. When you modify the configuration:

1. The server detects the change
2. Automatically restarts with the new configuration
3. The browser will refresh with updated settings

This allows you to iterate on your configuration without manually restarting the server.

## Project Structure

When using the CLI, your project structure should look like:

```
my-project/
├── shellui.config.json    # or shellui.config.ts
├── package.json
├── dist/                  # Production build output
└── node_modules/
```

## Tips

- Use TypeScript configuration files for better IDE support and type checking
- The CLI automatically handles hot reloading during development
- Configuration changes trigger automatic server restarts
- Production builds are optimized and ready for deployment
- Check the terminal output for server URLs and build status

## Troubleshooting

### Command Not Found

If you see `command not found: shellui`, ensure the CLI is installed:

```bash
npm install -g @shellui/cli
```

Or use `npx`:

```bash
npx shellui start
```

### Configuration Not Found

Ensure your configuration file is named correctly:

- `shellui.config.json` (for JSON)
- `shellui.config.ts` (for TypeScript)

And that it's in the project root directory.

### Port Already in Use

Change the port in your configuration file:

```json
{
  "port": 5000
}
```

### TypeScript Config Not Loading

Ensure TypeScript is installed if using `shellui.config.ts`:

```bash
npm install -D typescript
```
