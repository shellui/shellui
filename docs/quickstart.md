# Quick Start Guide

Get up and running with ShellUI in minutes. This guide will walk you through creating your first ShellUI application.

## Prerequisites

- Node.js 18.0.0 or higher
- ShellUI CLI installed ([Installation Guide](/installation))

## Step 1: Create Your Project

Create a new directory for your ShellUI application:

```bash
mkdir my-shellui-app
cd my-shellui-app
```

Initialize a Node.js project (optional, but recommended):

```bash
npm init -y
```

## Step 2: Install ShellUI CLI

Install the ShellUI CLI as a dev dependency:

```bash
npm install --save-dev @shellui/cli
```

Or install globally:

```bash
npm install -g @shellui/cli
```

## Step 3: Create Configuration File

Create a configuration file in your project root. ShellUI supports both JSON and TypeScript configuration files.

### Option A: JSON Configuration

Create `shellui.config.json`:

```json
{
  "port": 4000,
  "title": "My ShellUI App",
  "navigation": [
    {
      "label": "Home",
      "path": "home",
      "url": "http://localhost:4000/",
      "icon": "Home"
    },
    {
      "label": "About",
      "path": "about",
      "url": "https://example.com/about",
      "icon": "Info"
    }
  ]
}
```

### Option B: TypeScript Configuration

Create `shellui.config.ts`:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'My ShellUI App',
  navigation: [
    {
      label: 'Home',
      path: 'home',
      url: 'http://localhost:4000/',
      icon: 'Home',
    },
    {
      label: 'About',
      path: 'about',
      url: 'https://example.com/about',
      icon: 'Info',
    },
  ],
};

export default config;
```

### Configuration Options

- **port** (number, optional): Port number for the development server (default: 3000)
- **title** (string, optional): Application title displayed in the UI
- **navigation** (array, optional): Array of navigation items with:
  - **label** (string): Display text for the navigation item
  - **path** (string): Unique path identifier
  - **url** (string): URL to navigate to
  - **icon** (string, optional): Icon name for the navigation item

## Step 4: Start the Development Server

Run the development server:

```bash
shellui start
```

Or if installed locally:

```bash
npx shellui start
```

The server will:

- Start on the configured port (default: 3000)
- Automatically open your browser
- Watch for configuration file changes and restart automatically
- Display the server URL in the terminal

You should see output like:

```
Starting ShellUI...
Loaded JSON config from /path/to/shellui.config.json
👀 Watching config file: /path/to/shellui.config.json

  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:4000/
  ➜  Network: use --host to expose
```

## Step 5: Build for Production

When you're ready to build your application for production:

```bash
shellui build
```

This will:

- Build your ShellUI application
- Output the production files to the `dist/` directory
- Optimize assets for production

The built files will be in the `dist/` directory and can be deployed to any static hosting service.

## Project Structure

A typical ShellUI project structure looks like:

```
my-shellui-app/
├── shellui.config.json    # or shellui.config.ts
├── package.json
├── dist/                  # Production build (generated)
└── node_modules/
```

## Next Steps

- **[Navigation Guide](/features/navigation)** - Learn how to configure navigation menus
- **[CLI Reference](/cli)** - Learn about all available commands
- **[Feature Guides](/)** - Explore all ShellUI features

## Troubleshooting

### Port Already in Use

If the default port is already in use, change it in your configuration:

```json
{
  "port": 5000
}
```

### Configuration Not Loading

- Ensure `shellui.config.json` or `shellui.config.ts` is in your project root
- Check that the JSON is valid (if using JSON format)
- For TypeScript config, ensure TypeScript is installed: `npm install -D typescript`

### Build Errors

- Ensure all dependencies are installed: `npm install`
- Check that your configuration file is valid
- Review error messages in the terminal for specific issues
