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

Create a configuration file in your project root. You can generate one with the CLI or create it manually.

### Option A: Generate with shellui init (recommended)

From your project directory, run:

```bash
shellui init
```

This creates a `shellui.config.ts` with sensible defaults (port, title, layout, and sample navigation including Home and Settings). To overwrite an existing config, use `shellui init --force`.

Add a `static/` folder with `favicon.svg`, `logo.svg`, and icons (e.g. `static/icons/home.svg`, `static/icons/settings.svg`) to customize assets, then skip to [Step 4: Start the Development Server](#step-4-start-the-development-server).

### Option B: Create shellui.config.ts manually

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'My ShellUI App',
  backend: {
    type: 'supabase',
    url: 'http://localhost:54321',
  },
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
- **backend** (object, optional): Backend config for auth/API communication (default: undefined)
  - **type** (`"shellui"` | `"supabase"`): Backend provider
  - **url** (string): Base API URL
- **navigation** (array, optional): Array of navigation items with:
  - **label** (string): Display text for the navigation item
  - **path** (string): Unique path identifier
  - **url** (string): URL to navigate to
  - **icon** (string, optional): Icon name for the navigation item
  - **hideWhenLoggedOut** (boolean, optional): Hide item from navigation while signed out
  - **requiresAuth** (boolean, optional): Require authentication for direct route access, redirects to `/login?next=...`
- **legalDocuments** (object, optional): Markdown content for legal pages
  - **privacyPolicy** (string, optional): Privacy Policy markdown
  - **termsOfService** (string, optional): Terms of Service markdown
  - **legalNotice** (string, optional): Legal Notice markdown
  - **dataProcessingAgreement** (string, optional): DPA markdown

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

Use `shellui start --host` to listen on `0.0.0.0` and access the app from other devices on your network.

You should see output like:

```
Starting ShellUI...
Loaded TypeScript config from /path/to/shellui.config.ts
👀 Watching config file: /path/to/shellui.config.ts

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
├── shellui.config.ts
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

- Ensure `shellui.config.ts` is in your project root
- Ensure TypeScript is installed: `npm install -D typescript`

### Build Errors

- Ensure all dependencies are installed: `npm install`
- Check that your configuration file is valid
- Review error messages in the terminal for specific issues
