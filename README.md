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

### Install dependencies

```bash
npm install
```

### Build all packages

```bash
npm run build
```

### Build individual packages

```bash
npm run build:cli
npm run build:core
npm run build:sdk
```

### Start development server

```bash
npm start
# or
npm run serve
```

### Run tests

```bash
npm test
```

## Publishing

### Publish all packages

```bash
npm run publish:all
```

### Publish individual packages

```bash
npm run publish:cli
npm run publish:core
npm run publish:sdk
```

## Workspace Scripts

### Build Scripts
- `npm run build` - Build all packages
- `npm run build:packages` - Build all workspace packages
- `npm run build:cli` - Build CLI package
- `npm run build:core` - Build Core package
- `npm run build:sdk` - Build SDK package

### Development Scripts
- `npm start` / `npm run serve` - Start development server
- `npm test` - Run tests across all packages

### Publishing Scripts
- `npm run publish:all` - Publish all packages
- `npm run publish:cli` - Publish CLI package
- `npm run publish:core` - Publish Core package
- `npm run publish:sdk` - Publish SDK package

### Documentation Scripts
- `npm run docs:install` - Install documentation dependencies
- `npm run docs:start` - Start documentation development server
- `npm run docs:build` - Build documentation site
- `npm run docs:serve` - Serve built documentation

### Utility Scripts
- `npm run clean` - Clean all node_modules

## License

MIT
