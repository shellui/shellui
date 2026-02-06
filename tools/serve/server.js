#!/usr/bin/env node
/**
 * Simple HTTP server for serving ShellUI SPA builds locally.
 * Serves index.html for all routes to support client-side routing.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get port from command line or use default
const port = process.argv[2] ? parseInt(process.argv[2], 10) : 8000;

// Resolve dist directory relative to project root (two levels up from tools/serve)
const projectRoot = path.resolve(__dirname, '../..');
const distDir = path.join(projectRoot, 'dist');

// Check if dist directory exists
if (!fs.existsSync(distDir)) {
  console.error(`Error: ${distDir} directory not found!`);
  console.error('Please run "pnpm build" or "shellui build" first.');
  process.exit(1);
}

// Check if index.html exists
const indexFile = path.join(distDir, 'index.html');
if (!fs.existsSync(indexFile)) {
  console.error(`Error: ${indexFile} not found!`);
  console.error('Please run "pnpm build" or "shellui build" first.');
  process.exit(1);
}

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webp': 'image/webp',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function serveFile(filePath, res) {
  const stat = fs.statSync(filePath);

  if (!stat.isFile()) {
    return false;
  }

  const mimeType = getMimeType(filePath);
  const content = fs.readFileSync(filePath);

  res.writeHead(200, {
    'Content-Type': mimeType,
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.end(content);
  return true;
}

const server = http.createServer((req, res) => {
  // Parse the requested path (remove query string)
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let requestedPath = parsedUrl.pathname;

  // Resolve the file path
  let filePath = path.join(distDir, requestedPath);

  // Normalize the path to prevent directory traversal
  filePath = path.normalize(filePath);

  // Ensure the resolved path is within distDir
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Check if it's a directory
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Try to serve the file if it exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    if (serveFile(filePath, res)) {
      return;
    }
  }

  // For all other paths (including 404s), serve index.html for SPA routing
  // This allows client-side routing to work
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    serveFile(indexPath, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
  console.log(`Serving from: ${distDir}`);
  console.log('Press Ctrl+C to stop the server');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nServer stopped.');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nServer stopped.');
  server.close(() => {
    process.exit(0);
  });
});
