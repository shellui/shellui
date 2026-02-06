# Installation

Install ShellUI to start building your microfrontend application.

## Prerequisites

- **Node.js** version 18.0.0 or higher
- **npm** (comes with Node.js)

## Install ShellUI CLI

The ShellUI CLI is the main tool you'll use to create, develop, and build ShellUI applications.

### Global Installation (Recommended)

Install the CLI globally to use it from anywhere on your system:

```bash
npm install -g @shellui/cli
```

After installation, you can use the `shellui` command from any directory:

```bash
shellui start
shellui build
```

### Local Installation

Alternatively, install the CLI as a dev dependency in your project:

```bash
npm install --save-dev @shellui/cli
```

Then use it via `npx`:

```bash
npx shellui start
npx shellui build
```

Or add scripts to your `package.json`:

```json
{
  "scripts": {
    "start": "shellui start",
    "build": "shellui build"
  }
}
```

## Verify Installation

Check that ShellUI CLI is installed correctly:

```bash
shellui --version
```

You should see the version number printed.

## Next Steps

Once installed, you're ready to:

1. **[Configure your ShellUI app](/quickstart#configuration)** - Create a configuration file
2. **[Start developing](/quickstart#running-the-development-server)** - Run the development server
3. **[Build for production](/cli#build)** - Build your application

## Additional Packages

The CLI automatically handles the core dependencies. If you need to integrate ShellUI programmatically, you can install:

- `@shellui/core` - Core React application runtime
- `@shellui/sdk` - JavaScript SDK for ShellUI integration

These are typically not needed for basic usage, as the CLI manages them automatically.
