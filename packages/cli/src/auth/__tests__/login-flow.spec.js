import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  DEVICE_GRANT_TYPE,
  LOGIN_DENIED_MESSAGE,
  LOGIN_EXPIRED_MESSAGE,
  LoginCancelledError,
  SHELLUI_CLI_CLIENT_ID,
  WAITING_MESSAGE,
  browserLaunchDecision,
  interruptibleSleep,
  parseDeviceCodeResponse,
  runLoginFlow,
  toLoginResult,
} from '../login-flow.js';

const BACKEND = 'https://id.shellui.com/';
const USER_CODE = 'ABCD-EFGH';
const DEVICE_CODE = 'device-secret-value';
const COMPLETE = `https://id.shellui.com/oauth/cli/device?user_code=${USER_CODE}`;

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function devicePayload(overrides = {}) {
  return {
    device_code: DEVICE_CODE,
    user_code: USER_CODE,
    verification_uri: 'https://id.shellui.com/oauth/cli/device',
    verification_uri_complete: COMPLETE,
    expires_in: 600,
    interval: 5,
    ...overrides,
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * @param {{
 *   tokenResponses?: Array<Response | Error>,
 *   deviceResponse?: Response | Error,
 *   interval?: number,
 *   expiresIn?: number,
 * }} [opts]
 */
function scriptedFetch(opts = {}) {
  const tokenResponses = [...(opts.tokenResponses ?? [jsonResponse(tokenSuccess())])];
  /** @type {string[]} */
  const events = [];
  /** @type {Array<{ url: string, init: RequestInit }>} */
  const calls = [];
  const fetchImpl = vi.fn(async (url, init) => {
    const href = String(url);
    calls.push({ url: href, init: /** @type {RequestInit} */ (init) });
    events.push(`fetch ${href}`);
    if (init?.signal?.aborted) {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    }
    if (href.endsWith('/oauth/cli/device/code')) {
      if (opts.deviceResponse instanceof Error) throw opts.deviceResponse;
      return (
        opts.deviceResponse ??
        jsonResponse(devicePayload({ interval: opts.interval, expires_in: opts.expiresIn }))
      );
    }
    const next = tokenResponses.shift();
    if (!next) throw new Error('unexpected token poll');
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetchImpl, events, calls };
}

function tokenSuccess(overrides = {}) {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 900,
    ...overrides,
  };
}

function oauthError(error, status = 400) {
  return jsonResponse({ error }, status);
}

/**
 * @param {Parameters<typeof runLoginFlow>[0]} [overrides]
 */
async function runFlow(overrides = {}) {
  /** @type {string[]} */
  const lines = [];
  /** @type {number[]} */
  const sleeps = [];
  let nowMs = 1_700_000_000_000;
  const opened = [];
  const script = overrides.fetchImpl
    ? null
    : scriptedFetch({
        tokenResponses: [jsonResponse(tokenSuccess())],
      });
  const result = await runLoginFlow({
    backendUrl: BACKEND,
    companyId: '9',
    noBrowser: true,
    env: {},
    platform: 'linux',
    isTTY: false,
    fetchImpl: script?.fetchImpl,
    log: (line) => lines.push(line),
    now: () => nowMs,
    sleep: async (ms) => {
      sleeps.push(ms);
      nowMs += ms;
    },
    openBrowser: async (url) => {
      opened.push(url);
    },
    ...overrides,
    ...(overrides.now
      ? {}
      : {
          now: () => nowMs,
        }),
  });
  return {
    result,
    lines,
    text: stripAnsi(lines.join('\n')),
    sleeps,
    opened,
    events: script?.events ?? [],
    calls: script?.calls ?? [],
    nowMs: () => nowMs,
  };
}

describe('parseDeviceCodeResponse', () => {
  test('reads the contract fields and builds a link when the complete URI is absent', () => {
    const parsed = parseDeviceCodeResponse(
      devicePayload({ verification_uri_complete: undefined, interval: '2', expires_in: '30' }),
    );
    expect(parsed).toMatchObject({
      deviceCode: DEVICE_CODE,
      userCode: USER_CODE,
      verificationUriComplete: COMPLETE,
      intervalSec: 2,
      expiresInSec: 30,
    });
  });

  test('defaults a missing interval to 5 seconds and a missing lifetime to 600 seconds', () => {
    const parsed = parseDeviceCodeResponse(
      devicePayload({ interval: undefined, expires_in: undefined }),
    );
    expect(parsed?.intervalSec).toBe(5);
    expect(parsed?.expiresInSec).toBe(600);
  });

  test('rejects a payload without a device code or user code', () => {
    expect(parseDeviceCodeResponse({ user_code: USER_CODE })).toBeNull();
    expect(parseDeviceCodeResponse(null)).toBeNull();
  });
});

describe('toLoginResult', () => {
  test('converts expires_in to a unix expiresAt and prefers it over expires_at', () => {
    const result = toLoginResult(
      {
        access_token: 'a',
        refresh_token: 'r',
        token_type: 'bearer',
        expires_in: 900,
        expires_at: 5,
      },
      1_700_000_000_000,
    );
    expect(result).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 1_700_000_000 + 900,
      tokenType: 'bearer',
    });
  });

  test('falls back to absolute expires_at when expires_in is absent', () => {
    const result = toLoginResult(
      { access_token: 'a', refresh_token: 'r', expires_at: '1700000900' },
      1_700_000_000_000,
    );
    expect(result.expiresAt).toBe(1_700_000_900);
    expect(result.tokenType).toBe('bearer');
  });
});

describe('browserLaunchDecision', () => {
  test('skips for --no-browser, SSH, and a headless session', () => {
    expect(
      browserLaunchDecision({ noBrowser: true, env: { DISPLAY: ':0' }, platform: 'linux' }),
    ).toMatchObject({
      open: false,
    });
    expect(
      browserLaunchDecision({ env: { SSH_CONNECTION: '1', DISPLAY: ':0' }, platform: 'darwin' })
        .open,
    ).toBe(false);
    expect(browserLaunchDecision({ env: { SSH_CLIENT: '1' }, platform: 'linux' }).message).toMatch(
      /SSH/,
    );
    expect(browserLaunchDecision({ env: { SSH_TTY: '/dev/pts/0' }, platform: 'linux' }).open).toBe(
      false,
    );
    expect(browserLaunchDecision({ env: {}, platform: 'linux' }).message).toMatch(/No display/);
    expect(browserLaunchDecision({ env: {}, platform: 'freebsd' }).open).toBe(false);
  });

  test('opens on a display, on Wayland, and on macOS or Windows without DISPLAY', () => {
    expect(browserLaunchDecision({ env: { DISPLAY: ':0' }, platform: 'linux' }).open).toBe(true);
    expect(
      browserLaunchDecision({ env: { WAYLAND_DISPLAY: 'wayland-0' }, platform: 'linux' }).open,
    ).toBe(true);
    expect(browserLaunchDecision({ env: {}, platform: 'darwin' }).open).toBe(true);
    expect(browserLaunchDecision({ env: {}, platform: 'win32' }).open).toBe(true);
  });
});

describe('interruptibleSleep', () => {
  test('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(interruptibleSleep(60_000, controller.signal)).rejects.toBeInstanceOf(
      LoginCancelledError,
    );
  });

  test('rejects in-flight sleep on abort', async () => {
    const controller = new AbortController();
    const pending = interruptibleSleep(60_000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(LoginCancelledError);
  });
});

describe('runLoginFlow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('requests a device code, prints the link and code, and stores session tokens', async () => {
    const script = scriptedFetch();
    const flow = await runFlow({
      fetchImpl: script.fetchImpl,
      noBrowser: false,
      env: { DISPLAY: ':0' },
      platform: 'linux',
    });

    expect(flow.result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 1_700_000_000 + 5 + 900,
      tokenType: 'bearer',
    });
    expect(flow.text).toContain('Sign in to Shellui');
    expect(flow.text).toContain(`Code  ${USER_CODE}`);
    expect(flow.text).toContain(`Link  ${COMPLETE}`);
    expect(flow.text).toContain('Opened the verification page in your browser.');
    expect(flow.text).toContain(WAITING_MESSAGE);
    expect(flow.text).not.toContain(DEVICE_CODE);
    expect(flow.opened).toEqual([COMPLETE]);
    expect(flow.sleeps).toEqual([5000]);

    const deviceCall = script.calls[0];
    expect(deviceCall.url).toBe('https://id.shellui.com/oauth/cli/device/code');
    expect(deviceCall.init.method).toBe('POST');
    expect(deviceCall.init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(deviceCall.init.body))).toEqual({
      client_id: SHELLUI_CLI_CLIENT_ID,
      company_id: '9',
    });

    const tokenCall = script.calls[1];
    expect(tokenCall.url).toBe('https://id.shellui.com/oauth/token');
    expect(tokenCall.init.headers).toMatchObject({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    const body = new URLSearchParams(String(tokenCall.init.body));
    expect(body.get('grant_type')).toBe(DEVICE_GRANT_TYPE);
    expect(body.get('device_code')).toBe(DEVICE_CODE);
    expect(body.get('client_id')).toBe(SHELLUI_CLI_CLIENT_ID);
    expect(script.events.map((event) => event.split(' ')[0])).toEqual(['fetch', 'fetch']);
  });

  test('waits the server interval, then adds 5 seconds on slow_down', async () => {
    const script = scriptedFetch({
      interval: 2,
      tokenResponses: [
        oauthError('authorization_pending'),
        oauthError('slow_down'),
        jsonResponse(tokenSuccess()),
      ],
    });
    const flow = await runFlow({ fetchImpl: script.fetchImpl });
    expect(flow.sleeps).toEqual([2000, 2000, 7000]);
    expect(flow.result.accessToken).toBe('access-token');
    expect(script.calls.filter((call) => call.url.endsWith('/oauth/token'))).toHaveLength(3);
  });

  test('does not open a browser for --no-browser', async () => {
    const flow = await runFlow({
      noBrowser: true,
      env: { DISPLAY: ':0' },
      platform: 'linux',
    });
    expect(flow.opened).toEqual([]);
    expect(flow.text).toContain('Browser launch skipped (--no-browser).');
  });

  test('skips the browser over SSH even when a display is set', async () => {
    const flow = await runFlow({
      noBrowser: false,
      env: { SSH_CONNECTION: '10.0.0.1 22', DISPLAY: ':0' },
      platform: 'darwin',
    });
    expect(flow.opened).toEqual([]);
    expect(flow.text).toContain('SSH session detected. Open the link in a browser.');
  });

  test('opens verification_uri_complete on macOS without DISPLAY', async () => {
    const flow = await runFlow({
      noBrowser: false,
      env: {},
      platform: 'darwin',
    });
    expect(flow.opened).toEqual([COMPLETE]);
  });

  test('keeps polling when the browser fails to open', async () => {
    const flow = await runFlow({
      noBrowser: false,
      env: { DISPLAY: ':0' },
      platform: 'linux',
      openBrowser: async () => {
        throw new Error('xdg-open missing');
      },
    });
    expect(flow.text).toContain('Could not open a browser. Open the link above.');
    expect(flow.result.refreshToken).toBe('refresh-token');
  });

  test('reports access_denied and expired_token without storing a session', async () => {
    const denied = scriptedFetch({ tokenResponses: [oauthError('access_denied')] });
    await expect(runFlow({ fetchImpl: denied.fetchImpl })).rejects.toThrow(LOGIN_DENIED_MESSAGE);

    const expired = scriptedFetch({ tokenResponses: [oauthError('expired_token')] });
    await expect(runFlow({ fetchImpl: expired.fetchImpl })).rejects.toThrow(LOGIN_EXPIRED_MESSAGE);
  });

  test('stops when the device code lifetime elapses while still pending', async () => {
    const script = scriptedFetch({
      expiresIn: 10,
      interval: 5,
      tokenResponses: [oauthError('authorization_pending'), oauthError('authorization_pending')],
    });
    await expect(runFlow({ fetchImpl: script.fetchImpl })).rejects.toThrow(LOGIN_EXPIRED_MESSAGE);
    expect(script.calls.filter((call) => call.url.endsWith('/oauth/token'))).toHaveLength(1);
  });

  test('surfaces an unknown token error and a failed device-code request', async () => {
    const unknown = scriptedFetch({
      tokenResponses: [
        jsonResponse({ error: 'invalid_client', error_description: 'Unknown client.' }, 401),
      ],
    });
    await expect(runFlow({ fetchImpl: unknown.fetchImpl })).rejects.toThrow(
      'Sign-in failed (Unknown client.).',
    );

    const failed = scriptedFetch({
      deviceResponse: jsonResponse({ error: 'invalid_request' }, 400),
    });
    await expect(runFlow({ fetchImpl: failed.fetchImpl })).rejects.toThrow(
      'Could not start sign-in (HTTP 400): invalid_request',
    );
    expect(failed.calls.some((call) => call.url.endsWith('/oauth/token'))).toBe(false);
  });

  test('retries a few transport failures, then stops', async () => {
    const network = new Error('socket hang up');
    const script = scriptedFetch({
      tokenResponses: [network, network, jsonResponse(tokenSuccess())],
    });
    const flow = await runFlow({ fetchImpl: script.fetchImpl });
    expect(flow.result.accessToken).toBe('access-token');

    const failing = scriptedFetch({
      tokenResponses: Array.from({ length: 5 }, () => new Error('down')),
    });
    await expect(runFlow({ fetchImpl: failing.fetchImpl })).rejects.toThrow(
      /Could not reach the identity server to finish sign-in/,
    );
  });

  test('cancels when sleep is aborted and does not poll the token endpoint', async () => {
    const script = scriptedFetch();
    const controller = new AbortController();
    await expect(
      runFlow({
        fetchImpl: script.fetchImpl,
        signal: controller.signal,
        sleep: async () => {
          controller.abort();
          throw new LoginCancelledError();
        },
      }),
    ).rejects.toBeInstanceOf(LoginCancelledError);
    expect(script.calls.some((call) => call.url.endsWith('/oauth/token'))).toBe(false);
  });

  test('turns an aborted token poll into LoginCancelledError', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).endsWith('/oauth/cli/device/code')) return jsonResponse(devicePayload());
      init?.signal?.addEventListener('abort', () => {});
      controller.abort();
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });
    await expect(
      runFlow({
        fetchImpl,
        signal: controller.signal,
        sleep: async () => {},
      }),
    ).rejects.toBeInstanceOf(LoginCancelledError);
  });

  test('draws a spinner on a TTY and clears it when login finishes', async () => {
    /** @type {string[]} */
    const writes = [];
    await runFlow({
      isTTY: true,
      write: (text) => writes.push(text),
    });
    expect(stripAnsi(writes[0])).toContain(WAITING_MESSAGE);
    expect(writes.at(-1)).toBe('\r\x1b[2K');
  });

  test('uses verification_uri_complete from the server exactly', async () => {
    const complete = 'https://id.shellui.com/oauth/cli/device?user_code=ABCD-EFGH&from=cli';
    const script = scriptedFetch({
      deviceResponse: jsonResponse(devicePayload({ verification_uri_complete: complete })),
    });
    const flow = await runFlow({
      fetchImpl: script.fetchImpl,
      noBrowser: false,
      env: { DISPLAY: ':0' },
      platform: 'linux',
    });
    expect(flow.opened).toEqual([complete]);
    expect(flow.text).toContain(complete);
  });
});
