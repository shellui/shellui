/**
 * Fail fast if the companion port is already taken (like Vite strictPort).
 * Next.js otherwise silently hops to 3001+, which breaks Shellui `dev.url`.
 */
import net from 'node:net';

const port = Number(process.argv[2] || 3000);
const host = '127.0.0.1';

const server = net.createServer();
server.once('error', (err) => {
  if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. Free it (or change shellui.config.json dev.url) so the Next.js companion matches Shellui.`,
    );
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
server.once('listening', () => {
  server.close(() => process.exit(0));
});
server.listen(port, host);
