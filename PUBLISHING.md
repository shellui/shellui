# Publishing Guide

This guide explains how to publish the ShellUI packages to npm.

## Prerequisites

1. Ensure you're logged into npm:

   ```bash
   npm login
   ```

2. Make sure all packages have the correct version numbers in their `package.json` files.

3. Build all packages before publishing:
   ```bash
   npm run build
   ```

## Publishing Individual Packages

### Publish CLI

```bash
npm run publish:cli
```

Or manually:

```bash
cd packages/cli
npm publish
```

### Publish Core

```bash
npm run publish:core
```

Or manually:

```bash
cd packages/core
npm publish
```

### Publish SDK

```bash
npm run publish:sdk
```

Or manually:

```bash
cd packages/sdk
npm publish
```

## Publishing All Packages

To publish all packages in order:

```bash
npm run publish:all
```

**Note:** This will publish packages sequentially. Make sure dependencies are correct (e.g., `@shellui/core` should be published before `@shellui/cli` and `@shellui/sdk` if they depend on it).

## Version Management

To update versions across all packages, you can use tools like:

- `npm version` (manual)
- `lerna` (for more advanced versioning)
- `changesets` (for changelog management)

Example with npm:

```bash
cd packages/cli && npm version patch
cd ../core && npm version patch
cd ../sdk && npm version patch
```

## Testing Before Publishing

1. Test locally by linking packages:

   ```bash
   npm run build
   cd packages/cli
   npm link
   ```

2. In another project:

   ```bash
   npm link @shellui/cli
   ```

3. Test the installation:
   ```bash
   npm install -g @shellui/cli
   shellui --version
   ```

## Troubleshooting

- **"Package already exists"**: The version number already exists on npm. Bump the version.
- **"Access denied"**: Make sure you're logged in and have access to publish to the `@shellui` scope.
- **"Missing files"**: Check the `files` field in each `package.json` to ensure all necessary files are included.
