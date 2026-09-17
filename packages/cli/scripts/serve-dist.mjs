#!/usr/bin/env node
/**
 * Serve a Shellui production build from dist/web with SPA fallback via 404.html.
 * Used by generated projects (`pnpm run serve:dist`) and the monorepo root script.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const port = process.argv[2] ? parseInt(process.argv[2], 10) : 8000;
const distDir = path.resolve(process.cwd(), 'dist', 'web');

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
  if (!stat.isFile()) return false;

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

function resolveSpaFallbackPath() {
  const notFoundPath = path.join(distDir, '404.html');
  if (fs.existsSync(notFoundPath)) return notFoundPath;
  return path.join(distDir, 'index.html');
}

if (!fs.existsSync(distDir)) {
  console.error(`Error: ${distDir} directory not found!`);
  console.error('Run "pnpm build" (or "shellui build") first.');
  process.exit(1);
}

const indexFile = path.join(distDir, 'index.html');
if (!fs.existsSync(indexFile)) {
  console.error(`Error: ${indexFile} not found!`);
  console.error('Run "pnpm build" (or "shellui build") first.');
  process.exit(1);
}

const spaFallbackPath = resolveSpaFallbackPath();

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let requestedPath = parsedUrl.pathname;
  let filePath = path.join(distDir, requestedPath);
  filePath = path.normalize(filePath);

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    if (serveFile(filePath, res)) return;
  }

  if (fs.existsSync(spaFallbackPath)) {
    serveFile(spaFallbackPath, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
  console.log(`Serving from: ${distDir}`);
  console.log(`Unknown routes fall back to ${path.basename(spaFallbackPath)}`);
  console.log('Press Ctrl+C to stop the server');
});

function shutdown() {
  console.log('\nServer stopped.');
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
