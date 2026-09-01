import { spawn } from 'child_process';
import http from 'http';
import https from 'https';
import net from 'net';
import { URL } from 'url';

const DEFAULT_PROBE_MS = 1000;
const DEFAULT_WAIT_TIMEOUT_MS = 60_000;
const DEFAULT_WAIT_INTERVAL_MS = 250;
const DEFAULT_FOLLOW_DEBOUNCE_MS = 2000;
const DEFAULT_FOLLOW_INTERVAL_MS = 500;

/**
 * @param {NodeJS.ReadableStream} stream
 * @param {string} prefix
 * @param {NodeJS.WritableStream} [dest]
 */
export function prefixStream(stream, prefix, dest = process.stdout) {
  let buf = '';
  const flushLine = (line) => {
    dest.write(`${prefix}${line}\n`);
  };
  stream.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      flushLine(line);
    }
  });
  stream.on('end', () => {
    if (buf) flushLine(buf);
  });
}

/**
 * Kill a spawned companion and its descendants.
 * Unix: process group (`kill(-pid)`). Windows: `taskkill /T`.
 * @param {import('child_process').ChildProcess | null | undefined} child
 * @param {NodeJS.Signals} [signal]
 */
export function killProcessTree(child, signal = 'SIGTERM') {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // already gone
    }
  }
}

/**
 * @param {string} urlString
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<boolean>}
 */
export function probeUrl(urlString, { timeoutMs = DEFAULT_PROBE_MS } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let parsed;
    try {
      parsed = new URL(urlString);
    } catch {
      const match = /^(?:\[([^\]]+)\]|([^:]+)):(\d+)$/.exec(String(urlString).trim());
      if (!match) {
        done(false);
        return;
      }
      const host = match[1] || match[2];
      const port = Number(match[3]);
      const socket = net.connect({ host, port }, () => {
        socket.destroy();
        done(true);
      });
      socket.setTimeout(timeoutMs, () => {
        socket.destroy();
        done(false);
      });
      socket.on('error', () => {
        socket.destroy();
        done(false);
      });
      return;
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(parsed, { method: 'GET', timeout: timeoutMs }, (res) => {
      res.resume();
      done(true);
    });
    req.on('timeout', () => {
      req.destroy();
      done(false);
    });
    req.on('error', () => done(false));
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll until the URL (or host:port) accepts connections.
 * @param {string} url
 * @param {{ timeoutMs?: number; intervalMs?: number }} [options]
 */
export async function waitForUrl(
  url,
  { timeoutMs = DEFAULT_WAIT_TIMEOUT_MS, intervalMs = DEFAULT_WAIT_INTERVAL_MS } = {},
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await probeUrl(url)) return;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

/**
 * After the URL has been healthy once, call `onDown` if it stays down for `debounceMs`.
 * A URL that never comes up does not trigger `onDown`.
 * @param {string} url
 * @param {{ debounceMs?: number; intervalMs?: number; onDown?: () => void }} [options]
 * @returns {() => void} stop
 */
export function followUrl(
  url,
  { debounceMs = DEFAULT_FOLLOW_DEBOUNCE_MS, intervalMs = DEFAULT_FOLLOW_INTERVAL_MS, onDown } = {},
) {
  let seenUp = false;
  let downSince = null;
  let stopped = false;

  const timer = setInterval(() => {
    if (stopped) return;
    void probeUrl(url).then((up) => {
      if (stopped) return;
      if (up) {
        seenUp = true;
        downSince = null;
        return;
      }
      if (!seenUp) return;
      if (downSince == null) downSince = Date.now();
      if (Date.now() - downSince >= debounceMs) {
        stopped = true;
        clearInterval(timer);
        onDown?.();
      }
    });
  }, intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/**
 * Spawn a companion command in a new process group (Unix) with prefixed stdio.
 * @param {{ command: string; cwd: string; name?: string; env?: NodeJS.ProcessEnv }} options
 * @returns {import('child_process').ChildProcess}
 */
export function spawnCompanion({ command, cwd, name = 'app', env = process.env }) {
  const child = spawn(command, {
    cwd,
    env,
    shell: true,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const prefix = `[${name}] `;
  if (child.stdout) prefixStream(child.stdout, prefix, process.stdout);
  if (child.stderr) prefixStream(child.stderr, prefix, process.stderr);
  return child;
}

/**
 * Resolve companion settings from config.dev plus CLI flags.
 * `--run` / `--follow` override config. `--no-run` (or `run: false`) ignores `dev.run`.
 * @param {{ dev?: { run?: string; url?: string; name?: string } } | null | undefined} config
 * @param {{ run?: string | false; follow?: string; noRun?: boolean }} [options]
 */
export function resolveCompanion(config, options = {}) {
  const dev = config?.dev && typeof config.dev === 'object' ? config.dev : {};
  const noRun = options.noRun === true || options.run === false;
  const runFromFlag = typeof options.run === 'string' && options.run ? options.run : undefined;
  const run = noRun
    ? undefined
    : (runFromFlag ?? (typeof dev.run === 'string' ? dev.run : undefined));
  const urlFromFlag =
    typeof options.follow === 'string' && options.follow ? options.follow : undefined;
  const url = urlFromFlag ?? (typeof dev.url === 'string' ? dev.url : undefined);
  const name = typeof dev.name === 'string' && dev.name ? dev.name : 'app';
  return { run, url, name };
}
