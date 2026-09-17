# Shellui Serve Tool

A simple Node.js HTTP server for serving Shellui production builds locally with SPA routing support.

## Usage

After building your Shellui application:

```bash
# From project root, serve on default port (8000)
pnpm run serve:dist

# Or run directly with a custom port
node packages/cli/scripts/serve-dist.mjs 8080
```

Generated projects use the same script via `@shellui/cli`:

```bash
node node_modules/@shellui/cli/scripts/serve-dist.mjs
```

## Features

- **SPA routing**: Unknown paths fall back to `404.html` (created by `shellui build`), so shell deep links work locally
- **Static file serving**: Serves actual files (assets, companion under `/app`, etc.) when they exist
- **Security**: Prevents directory traversal attacks
- **Cache control**: Disables caching for local preview

## How It Works

1. The server checks if the requested path exists as a file under `dist/web`
2. If the file exists, it serves it with the appropriate MIME type
3. If the file does not exist, it serves `404.html` (or `index.html` if `404.html` is missing)
4. `shellui build` copies `index.html` to `404.html` for hosting providers; the local server uses the same fallback

## Requirements

- Node.js >= 18.0.0
- A built `dist/web` directory (run `pnpm build` first)
