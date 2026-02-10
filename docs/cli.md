# ShellUI CLI

The ShellUI CLI is the command-line tool for developing and building ShellUI applications.

## Installation

See the [Installation Guide](/installation) for detailed installation instructions.

## Commands

### `shellui init [root]`

Create a `shellui.config.ts` boilerplate to get started quickly.

**Usage:**

```bash
shellui init
shellui init ./my-project
shellui init --force
```

**Description:**

- Creates a minimal `shellui.config.ts` in the project root (or the given directory)
- Includes port, title, layout, language, and sample navigation (Home + Settings)
- Does not overwrite an existing config unless `--force` is used

**Options:**

- `root` (optional): Directory where to create the config (default: current directory)
- `--force`: Overwrite existing `shellui.config.ts` or `shellui.config.json`

**Example:**

```bash
# Create config in current directory
shellui init

# Create config in a subdirectory
shellui init ./my-app

# Overwrite existing config
shellui init --force
```

After running `shellui init`, add a `static/` folder with `favicon.svg`, `logo.svg`, and `icons/` (e.g. `home.svg`, `settings.svg`) to customize assets, then run `shellui start` to begin development.

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

Array of navigation items for the sidebar. See the [Navigation Guide](/features/navigation) for complete documentation.

```json
{
  "navigation": [
    {
      "label": "Home",
      "path": "home",
      "url": "http://localhost:4000/",
      "icon": "/icons/home.svg"
    }
  ]
}
```

**Basic Navigation Item Properties:**

- `label` (string | LocalizedString, required): Display text for the navigation item
- `path` (string, required): Unique path identifier
- `url` (string, required): URL to navigate to when clicked
- `icon` (string, optional): Path to SVG icon file (e.g., "/icons/home.svg")

For advanced navigation features like groups, localization, visibility control, and opening modes, see the [Navigation Guide](/features/navigation).

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

## Configuration Reference

For detailed configuration options, see:

- **[Navigation](/features/navigation)** - Navigation menus, groups, icons, and display modes
- **[Layouts](/features/layouts)** - Sidebar, fullscreen, windows (experimental), and app bar layouts
- **[Themes](/features/themes)** - Custom themes, fonts, and colors
- **[Internationalization](/features/internationalization)** - Multi-language support
- **[Cookie Consent](/features/cookie-consent)** - Privacy and cookie management

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
