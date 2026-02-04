# ShellUI Serve Tool

A simple Node.js HTTP server for serving ShellUI production builds locally with SPA routing support.

## Usage

After building your ShellUI application:

```bash
# From project root, serve on default port (8000)
pnpm run serve:dist

# Or run directly with a custom port
node tools/serve/server.js 8080
```

## Features

- **SPA Routing Support**: Automatically serves `index.html` for all routes, enabling client-side routing to work correctly
- **Static File Serving**: Serves actual files (assets, images, etc.) when they exist
- **Security**: Prevents directory traversal attacks
- **Cache Control**: Sets appropriate headers to prevent caching during development

## How It Works

1. The server checks if the requested path exists as a file
2. If the file exists, it serves it with the appropriate MIME type
3. If the file doesn't exist, it falls back to serving `index.html`
4. This allows client-side routers (like React Router) to handle routing

## Requirements

- Node.js >= 18.0.0
- A built `dist` directory (run `pnpm build` first)
