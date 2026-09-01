import { test, describe, expect } from 'vitest';
import http from 'http';
import { PassThrough } from 'stream';
import {
  prefixStream,
  probeUrl,
  waitForUrl,
  followUrl,
  spawnCompanion,
  killProcessTree,
  resolveCompanion,
} from '../supervisor.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}/`);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

function waitExit(child) {
  return new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
}

describe('resolveCompanion', () => {
  test('reads config.dev', () => {
    expect(
      resolveCompanion({ dev: { run: 'vite', url: 'http://localhost:5173', name: 'web' } }),
    ).toEqual({
      run: 'vite',
      url: 'http://localhost:5173',
      name: 'web',
    });
  });

  test('flags override config; --no-run drops spawn', () => {
    const config = { dev: { run: 'vite', url: 'http://localhost:5173' } };
    expect(resolveCompanion(config, { run: 'pnpm start:app' }).run).toBe('pnpm start:app');
    expect(resolveCompanion(config, { follow: 'http://127.0.0.1:9' }).url).toBe(
      'http://127.0.0.1:9',
    );
    expect(resolveCompanion(config, { noRun: true })).toEqual({
      run: undefined,
      url: 'http://localhost:5173',
      name: 'app',
    });
    expect(resolveCompanion(config, { run: false }).run).toBeUndefined();
  });
});

describe('prefixStream', () => {
  test('prefixes complete lines', async () => {
    const src = new PassThrough();
    const dest = new PassThrough();
    const chunks = [];
    dest.on('data', (c) => chunks.push(c.toString()));
    prefixStream(src, '[app] ', dest);
    src.write('hello\nwor');
    src.write('ld\n');
    await new Promise((resolve) => src.end(resolve));
    expect(chunks.join('')).toBe('[app] hello\n[app] world\n');
  });
});

describe('waitForUrl / followUrl', () => {
  test('waitForUrl resolves once HTTP is up', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    const url = await listen(server);
    try {
      await waitForUrl(url, { timeoutMs: 2000, intervalMs: 20 });
      expect(await probeUrl(url)).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  test('waitForUrl times out when nothing listens', async () => {
    await expect(
      waitForUrl('http://127.0.0.1:1', { timeoutMs: 150, intervalMs: 40 }),
    ).rejects.toThrow(/Timed out/);
  });

  test('followUrl fires after URL was up then stays down', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(204);
      res.end();
    });
    const url = await listen(server);
    try {
      await waitForUrl(url, { timeoutMs: 2000, intervalMs: 20 });
      const down = new Promise((resolve) => {
        followUrl(url, { debounceMs: 80, intervalMs: 20, onDown: resolve });
      });
      await new Promise((r) => setTimeout(r, 50));
      await closeServer(server);
      await down;
    } catch (e) {
      try {
        await closeServer(server);
      } catch {
        // already closed
      }
      throw e;
    }
  });

  test('followUrl does not fire if URL never came up', async () => {
    let fired = false;
    const stop = followUrl('http://127.0.0.1:1', {
      debounceMs: 30,
      intervalMs: 20,
      onDown: () => {
        fired = true;
      },
    });
    await new Promise((r) => setTimeout(r, 120));
    stop();
    expect(fired).toBe(false);
  });
});

describe('spawnCompanion', () => {
  test('reports the child exit code', async () => {
    const child = spawnCompanion({
      command: 'node -e "process.exit(7)"',
      cwd: process.cwd(),
      name: 'app',
    });
    const { code } = await waitExit(child);
    expect(code).toBe(7);
  });

  test('killProcessTree stops a long-running child', async () => {
    const child = spawnCompanion({
      command: 'node -e "setInterval(() => {}, 1000)"',
      cwd: process.cwd(),
      name: 'app',
    });
    await new Promise((r) => setTimeout(r, 50));
    killProcessTree(child, 'SIGKILL');
    const { code, signal } = await waitExit(child);
    expect(code === 0 || code === 1 || code == null || signal).toBeTruthy();
  });
});
