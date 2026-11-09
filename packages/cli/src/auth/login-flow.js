import { spawn } from 'child_process';
import pc from 'picocolors';

/** OAuth client id for this CLI. Not interchangeable with the MCP device client. */
export const SHELLUI_CLI_CLIENT_ID = 'shellui-cli';

/** RFC 8628 device-code grant. */
export const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

const DEVICE_CODE_PATH = '/oauth/cli/device/code';
const TOKEN_PATH = '/oauth/token';
const DEFAULT_INTERVAL_SEC = 5;
const SLOW_DOWN_STEP_SEC = 5;
const DEFAULT_EXPIRES_SEC = 600;
const MAX_TRANSIENT_FAILURES = 5;

export const WAITING_MESSAGE = 'Waiting for approval…';

export const LOGIN_DENIED_MESSAGE = 'Sign-in was denied.';
export const LOGIN_EXPIRED_MESSAGE = 'The sign-in code expired. Run shellui login again.';

export class LoginCancelledError extends Error {
  constructor() {
    super('Login cancelled.');
    this.name = 'LoginCancelledError';
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function intervalSeconds(value) {
  const parsed = asNumber(value);
  if (parsed == null || parsed < 1) return DEFAULT_INTERVAL_SEC;
  return parsed;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function expiresSeconds(value) {
  if (value == null || value === '') return DEFAULT_EXPIRES_SEC;
  const parsed = asNumber(value);
  if (parsed == null || parsed < 0) return DEFAULT_EXPIRES_SEC;
  return parsed;
}

/**
 * @param {string} verificationUri
 * @param {string} userCode
 * @returns {string}
 */
function verificationUriWithCode(verificationUri, userCode) {
  try {
    const url = new URL(verificationUri);
    if (!url.searchParams.get('user_code')) {
      url.searchParams.set('user_code', userCode);
    }
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * @param {unknown} payload
 * @returns {{
 *   deviceCode: string,
 *   userCode: string,
 *   verificationUri: string,
 *   verificationUriComplete: string,
 *   intervalSec: number,
 *   expiresInSec: number,
 * } | null}
 */
export function parseDeviceCodeResponse(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const body = /** @type {Record<string, unknown>} */ (payload);
  const deviceCode = asString(body.device_code);
  const userCode = asString(body.user_code);
  const verificationUri = asString(body.verification_uri);
  const verificationUriComplete =
    asString(body.verification_uri_complete) || verificationUriWithCode(verificationUri, userCode);
  if (!deviceCode || !userCode || !verificationUriComplete) return null;
  return {
    deviceCode,
    userCode,
    verificationUri: verificationUri || verificationUriComplete,
    verificationUriComplete,
    intervalSec: intervalSeconds(body.interval),
    expiresInSec: expiresSeconds(body.expires_in),
  };
}

/**
 * Map a token response onto the credential fields the rest of the CLI stores.
 * Device login returns `expires_in` (seconds). `expiresAt` is the unix expiry
 * `isAccessTokenExpired` already compares against.
 * @param {Record<string, unknown>} payload
 * @param {number} [nowMs]
 */
export function toLoginResult(payload, nowMs = Date.now()) {
  const expiresIn = asNumber(payload.expires_in);
  let expiresAt = null;
  if (expiresIn != null && expiresIn >= 0) {
    expiresAt = Math.floor(nowMs / 1000) + Math.floor(expiresIn);
  } else {
    const absolute = asNumber(payload.expires_at);
    expiresAt = absolute != null ? Math.floor(absolute) : null;
  }
  return {
    accessToken: /** @type {string} */ (payload.access_token),
    refreshToken: /** @type {string} */ (payload.refresh_token),
    expiresAt,
    tokenType: asString(payload.token_type) || 'bearer',
  };
}

/**
 * @param {AbortSignal | undefined} signal
 */
function throwIfAborted(signal) {
  if (signal?.aborted) throw new LoginCancelledError();
}

/**
 * @param {unknown} err
 * @param {AbortSignal | undefined} signal
 */
function rethrowIfAborted(err, signal) {
  if (err instanceof LoginCancelledError) throw err;
  if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
    throw new LoginCancelledError();
  }
}

/**
 * Wait `ms`, and reject as soon as `signal` aborts (Ctrl+C).
 * @param {number} ms
 * @param {AbortSignal | undefined} [signal]
 */
export function interruptibleSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LoginCancelledError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new LoginCancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * @param {string} url
 * @returns {Promise<void>}
 */
export function openBrowser(url) {
  const platform = process.platform;
  /** @type {import('child_process').ChildProcess} */
  let child;
  if (platform === 'darwin') {
    child = spawn('open', [url], { stdio: 'ignore', detached: true });
  } else if (platform === 'win32') {
    child = spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true });
  } else {
    child = spawn('xdg-open', [url], { stdio: 'ignore', detached: true });
  }
  child.unref();
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('spawn', () => resolve());
  });
}

/**
 * @param {NodeJS.ProcessEnv} env
 */
function hasSshSession(env) {
  return ['SSH_CONNECTION', 'SSH_CLIENT', 'SSH_TTY'].some((key) => {
    const value = env[key];
    return typeof value === 'string' && value.trim() !== '';
  });
}

/**
 * @param {NodeJS.ProcessEnv} env
 */
function hasGraphicalDisplay(env) {
  const display = typeof env.DISPLAY === 'string' ? env.DISPLAY.trim() : '';
  const wayland = typeof env.WAYLAND_DISPLAY === 'string' ? env.WAYLAND_DISPLAY.trim() : '';
  return Boolean(display || wayland);
}

/**
 * Open the verification page when a display is available.
 * `--no-browser`, an SSH session, or a headless Linux/BSD session skip it.
 * macOS and Windows do not need `DISPLAY`.
 * @param {{
 *   noBrowser?: boolean,
 *   env?: NodeJS.ProcessEnv,
 *   platform?: NodeJS.Platform,
 * }} [opts]
 * @returns {{ open: boolean, message: string }}
 */
export function browserLaunchDecision(opts = {}) {
  if (opts.noBrowser) {
    return { open: false, message: 'Browser launch skipped (--no-browser).' };
  }
  const env = opts.env ?? process.env;
  if (hasSshSession(env)) {
    return { open: false, message: 'SSH session detected. Open the link in a browser.' };
  }
  const platform = opts.platform ?? process.platform;
  if (platform !== 'darwin' && platform !== 'win32' && !hasGraphicalDisplay(env)) {
    return { open: false, message: 'No display detected. Open the link in a browser.' };
  }
  return { open: true, message: '' };
}

/**
 * @param {{
 *   message: string,
 *   isTTY: boolean,
 *   write: (text: string) => void,
 *   log: (line: string) => void,
 * }} opts
 */
export function startWaitingLine(opts) {
  if (!opts.isTTY) {
    opts.log(pc.dim(opts.message));
    return { stop() {} };
  }
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;
  let stopped = false;
  const render = () => {
    opts.write(`\r${pc.cyan(frames[frame])} ${opts.message}`);
  };
  render();
  const timer = setInterval(() => {
    frame = (frame + 1) % frames.length;
    render();
  }, 80);
  if (typeof timer.unref === 'function') timer.unref();
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      opts.write('\r\x1b[2K');
    },
  };
}

/**
 * @param {Response} res
 */
async function readBody(res) {
  const text = await res.text().catch(() => '');
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (trimmed.includes('=')) {
    /** @type {Record<string, string>} */
    const parsed = {};
    for (const [key, value] of new URLSearchParams(trimmed)) parsed[key] = value;
    return parsed;
  }
  return null;
}

/**
 * @param {number} status
 * @param {unknown} payload
 */
function deviceStartError(status, payload) {
  const body =
    payload && typeof payload === 'object' ? /** @type {Record<string, unknown>} */ (payload) : {};
  const extra = asString(body.error_description) || asString(body.detail) || asString(body.error);
  if (extra) return `Could not start sign-in (HTTP ${status}): ${extra}`;
  return `Could not start sign-in (HTTP ${status}).`;
}

/**
 * @param {string} backendUrl
 */
function endpoint(backendUrl, path) {
  return `${backendUrl.replace(/\/$/, '')}${path}`;
}

/**
 * @param {{
 *   backendUrl: string,
 *   companyId: string,
 *   fetchImpl: typeof fetch,
 *   signal?: AbortSignal,
 * }} opts
 */
async function requestDeviceCode(opts) {
  const url = endpoint(opts.backendUrl, DEVICE_CODE_PATH);
  /** @type {Response} */
  let res;
  try {
    res = await opts.fetchImpl(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: SHELLUI_CLI_CLIENT_ID,
        company_id: String(opts.companyId),
      }),
      signal: opts.signal,
    });
  } catch (err) {
    rethrowIfAborted(err, opts.signal);
    throw new Error('Could not reach the identity server to start sign-in.');
  }
  const payload = await readBody(res);
  if (!res.ok) throw new Error(deviceStartError(res.status, payload));
  const device = parseDeviceCodeResponse(payload);
  if (!device) throw new Error('Sign-in did not return a device code and user code.');
  return device;
}

/**
 * @param {unknown} payload
 * @param {number} status
 * @param {boolean} ok
 * @param {number} nowMs
 * @returns {{ kind: 'pending' | 'slow_down' | 'denied' | 'expired' | 'success' | 'transient' | 'fatal', tokens?: ReturnType<typeof toLoginResult>, message?: string }}
 */
function classifyTokenResponse(payload, status, ok, nowMs) {
  const body =
    payload && typeof payload === 'object' ? /** @type {Record<string, unknown>} */ (payload) : {};
  const error = asString(body.error);
  if (error === 'authorization_pending') return { kind: 'pending' };
  if (error === 'slow_down') return { kind: 'slow_down' };
  if (error === 'access_denied') return { kind: 'denied' };
  if (error === 'expired_token') return { kind: 'expired' };
  if (
    ok &&
    typeof body.access_token === 'string' &&
    body.access_token &&
    typeof body.refresh_token === 'string' &&
    body.refresh_token
  ) {
    return { kind: 'success', tokens: toLoginResult(body, nowMs) };
  }
  if (status >= 500 || status === 429) return { kind: 'transient' };
  const description = asString(body.error_description) || asString(body.detail);
  const detail = description || error || `HTTP ${status}`;
  return { kind: 'fatal', message: `Sign-in failed (${detail}).` };
}

/**
 * @param {{
 *   backendUrl: string,
 *   deviceCode: string,
 *   fetchImpl: typeof fetch,
 *   signal?: AbortSignal,
 *   now: () => number,
 * }} opts
 */
async function pollDeviceToken(opts) {
  throwIfAborted(opts.signal);
  try {
    const res = await opts.fetchImpl(endpoint(opts.backendUrl, TOKEN_PATH), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: DEVICE_GRANT_TYPE,
        device_code: opts.deviceCode,
        client_id: SHELLUI_CLI_CLIENT_ID,
      }).toString(),
      signal: opts.signal,
    });
    const payload = await readBody(res);
    return classifyTokenResponse(payload, res.status, res.ok, opts.now());
  } catch (err) {
    rethrowIfAborted(err, opts.signal);
    return { kind: /** @type {'transient'} */ ('transient') };
  }
}

/**
 * @param {(line: string) => void} log
 * @param {{ userCode: string, verificationUriComplete: string }} device
 */
function printLoginInstructions(log, device) {
  log(pc.cyan('Sign in to Shellui'));
  log('');
  log(`  ${pc.bold('Code')}  ${pc.bold(device.userCode)}`);
  log(`  ${pc.bold('Link')}  ${device.verificationUriComplete}`);
  log('');
}

/**
 * Device authorization (RFC 8628) against identity-service.
 * Stores nothing; the login command writes the returned tokens.
 * @param {{
 *   backendUrl: string,
 *   companyId: string,
 *   noBrowser?: boolean,
 *   signal?: AbortSignal,
 *   fetchImpl?: typeof fetch,
 *   sleep?: (ms: number, signal?: AbortSignal) => Promise<void>,
 *   now?: () => number,
 *   openBrowser?: (url: string) => void | Promise<void>,
 *   log?: (line: string) => void,
 *   env?: NodeJS.ProcessEnv,
 *   platform?: NodeJS.Platform,
 *   isTTY?: boolean,
 *   write?: (text: string) => void,
 * }} opts
 * @returns {Promise<{
 *   accessToken: string,
 *   refreshToken: string,
 *   expiresAt: number | null,
 *   tokenType: string,
 * }>}
 */
export async function runLoginFlow(opts) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const sleep = opts.sleep ?? interruptibleSleep;
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((line) => console.log(line));
  const openBrowserImpl = opts.openBrowser ?? openBrowser;
  const isTTY = opts.isTTY ?? Boolean(process.stderr.isTTY);
  const write = opts.write ?? ((text) => process.stderr.write(text));
  const signal = opts.signal;

  const device = await requestDeviceCode({
    backendUrl: opts.backendUrl,
    companyId: opts.companyId,
    fetchImpl,
    signal,
  });

  printLoginInstructions(log, device);

  const launch = browserLaunchDecision({
    noBrowser: opts.noBrowser === true,
    env: opts.env,
    platform: opts.platform,
  });
  if (launch.open) {
    try {
      await openBrowserImpl(device.verificationUriComplete);
      log(pc.dim('Opened the verification page in your browser.'));
    } catch {
      log(pc.yellow('Could not open a browser. Open the link above.'));
    }
  } else {
    log(pc.dim(launch.message));
  }

  const waiting = startWaitingLine({ message: WAITING_MESSAGE, isTTY, write, log });
  try {
    let intervalSec = device.intervalSec;
    const deadline = now() + device.expiresInSec * 1000;
    let transientFailures = 0;

    while (true) {
      throwIfAborted(signal);
      if (now() >= deadline) throw new Error(LOGIN_EXPIRED_MESSAGE);
      await sleep(intervalSec * 1000, signal);
      throwIfAborted(signal);
      if (now() >= deadline) throw new Error(LOGIN_EXPIRED_MESSAGE);

      const result = await pollDeviceToken({
        backendUrl: opts.backendUrl,
        deviceCode: device.deviceCode,
        fetchImpl,
        signal,
        now,
      });

      if (result.kind === 'pending') {
        transientFailures = 0;
        continue;
      }
      if (result.kind === 'slow_down') {
        transientFailures = 0;
        intervalSec += SLOW_DOWN_STEP_SEC;
        continue;
      }
      if (result.kind === 'denied') throw new Error(LOGIN_DENIED_MESSAGE);
      if (result.kind === 'expired') throw new Error(LOGIN_EXPIRED_MESSAGE);
      if (result.kind === 'success' && result.tokens) return result.tokens;
      if (result.kind === 'transient') {
        transientFailures += 1;
        if (transientFailures >= MAX_TRANSIENT_FAILURES) {
          throw new Error(
            'Could not reach the identity server to finish sign-in. Run shellui login again.',
          );
        }
        continue;
      }
      throw new Error(result.message || 'Sign-in failed.');
    }
  } finally {
    waiting.stop();
  }
}
