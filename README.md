# ShellUI Monorepo

> A lightweight microfrontend shell to ship apps faster.

This monorepo contains the ShellUI packages:

- **@shellui/cli** - Command-line tool for ShellUI
- **@shellui/core** - Core React application runtime
- **@shellui/sdk** - JavaScript SDK for ShellUI integration

## Structure

```
.
├── packages/
│   ├── cli/          # CLI package
│   ├── core/         # Core React app
│   └── sdk/          # SDK package
├── docs/              # Documentation files
├── tools/             # Development tools (Docusaurus)
└── package.json       # Root workspace configuration
```

## Development

### Prerequisites

This project uses [pnpm](https://pnpm.io/) as its package manager. Install it globally if you haven't already:

```bash
npm install -g pnpm
```

### Install dependencies

```bash
pnpm install
```

### Build all packages

```bash
pnpm run build
```

### Build individual packages

```bash
pnpm run build:cli
pnpm run build:core
pnpm run build:sdk
```

### Start development server

```bash
pnpm start
# or
pnpm run serve
```

### Run tests

```bash
pnpm test
```

### Serve production build locally

After building, you can serve the production build locally with SPA routing support:

```bash
# Build the application
pnpm build

# Serve using Node.js HTTP server (supports SPA routing)
# Default port is 8000
pnpm run serve:dist

# Or specify a custom port directly
node tools/serve/server.js 8080
```

The server automatically serves `index.html` for all routes, enabling client-side routing to work correctly. This is useful for testing the production build locally.

**Note:** The build process automatically creates a `404.html` file (identical to `index.html`) for hosting providers that support it (like Netlify, Vercel, etc.).

## Publishing

Publish all packages (SDK, Core, CLI) in the correct order with one command:

```bash
pnpm run publish
```

The npm dist-tag is chosen automatically from the root **version** in `package.json`:

- Version contains **`alpha`** (e.g. `0.2.0-alpha.0`) → published with tag `alpha`
- Version contains **`beta`** (e.g. `0.2.0-beta.1`) → published with tag `beta`
- Otherwise → published with tag `latest`

Keep versions in sync across packages with `pnpm run version:sync` before publishing. See [Publishing Guide](docs/publishing.md) for the full workflow.

## Workspace Scripts

### Build Scripts

- `pnpm run build` - Build all packages
- `pnpm run build:packages` - Build all workspace packages
- `pnpm run build:cli` - Build CLI package
- `pnpm run build:core` - Build Core package
- `pnpm run build:sdk` - Build SDK package

### Development Scripts

- `pnpm start` / `pnpm run serve` - Start development server
- `pnpm test` - Run tests across all packages

### Publishing Scripts

- `pnpm run publish` - Publish all packages (SDK → Core → CLI) with tag from version (alpha/beta/latest)
- `pnpm run version:sync` - Sync root version to all packages

### Documentation Scripts

- `pnpm run docs:install` - Install documentation dependencies
- `pnpm run docs:start` - Start documentation development server
- `pnpm run docs:build` - Build documentation site
- `pnpm run docs:serve` - Serve built documentation

### Utility Scripts

- `pnpm run clean` - Clean all node_modules

## License

MIT
