import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../hosting/client.js', () => ({
  hostingFetch: vi.fn(),
  hostingUpload: vi.fn(),
  readHostingError: vi.fn(async () => 'hosting error'),
}));

import { hostingFetch, hostingUpload } from '../../hosting/client.js';
import { deployCommand, formatOauthRedirectWarning, promoteCommand } from '../deploy.js';

const ORIGIN = 'https://demo.shellui.app';
const REASON =
  'Identity rejected the origin (HTTP 403): Forbidden. Only a company owner or staff user can register hosted origins.';
const WARNING = `Sign-in won't work yet: ${ORIGIN} wasn't added to allowed redirects. ${REASON}`;

/** @type {string[]} */
let projects = [];

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function previewBody(extra = {}) {
  return {
    slug: 'demo',
    deployment: { id: 'dep-1' },
    urls: { url: ORIGIN },
    ...extra,
  };
}

function finalizeBody(extra = {}) {
  return {
    id: 'dep-1',
    urls: { url: ORIGIN },
    expires_at: '2026-10-20T00:00:00Z',
    ...extra,
  };
}

function mockHosting({ preview, finalize }) {
  hostingFetch.mockImplementation(async (_url, requestPath) => {
    if (requestPath === '/hosting/v1/preview') {
      return { response: jsonResponse(preview, 201) };
    }
    if (String(requestPath).endsWith('/finalize')) {
      return { response: jsonResponse(finalize, 200) };
    }
    throw new Error(`unexpected hosting path ${requestPath}`);
  });
  hostingUpload.mockResolvedValue({ response: jsonResponse({ ok: true }) });
}

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shellui-deploy-'));
  fs.chmodSync(dir, 0o700);
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'demo',
      version: '1.2.3',
      dependencies: { '@shellui/core': '0.6.0' },
    }),
  );
  fs.writeFileSync(
    path.join(dir, 'shellui.config.json'),
    JSON.stringify({
      title: 'Demo',
      version: '1.2.3',
      hosting: { url: 'http://127.0.0.1:9' },
    }),
  );
  const dist = path.join(dir, 'dist', 'web');
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Demo</title>');
  projects.push(dir);
  return dir;
}

async function runDeploy(dir, options = {}, run = deployCommand) {
  const logs = [];
  const warns = [];
  const errors = [];
  const log = console.log;
  const warn = console.warn;
  const error = console.error;
  console.log = (...args) => {
    logs.push(args.map(String).join(' '));
  };
  console.warn = (...args) => {
    warns.push(args.map(String).join(' '));
  };
  console.error = (...args) => {
    errors.push(args.map(String).join(' '));
  };
  const previousExit = process.exitCode;
  process.exitCode = 0;
  try {
    await run(dir, options);
  } finally {
    console.log = log;
    console.warn = warn;
    console.error = error;
  }
  const exitCode = process.exitCode;
  process.exitCode = previousExit;
  return { logs, warns, errors, exitCode };
}

function signInWarnings(warns) {
  return warns.filter((line) => line.includes("Sign-in won't work yet:"));
}

describe('formatOauthRedirectWarning', () => {
  test('uses the origin and hosting reason when registration failed', () => {
    expect(
      formatOauthRedirectWarning({
        oauth_redirect_registered: false,
        oauth_redirect_origin: ORIGIN,
        oauth_redirect_warning: REASON,
      }),
    ).toBe(WARNING);
  });

  test('stays silent when the field is missing or registration succeeded', () => {
    expect(formatOauthRedirectWarning({ slug: 'demo' })).toBeNull();
    expect(formatOauthRedirectWarning(null)).toBeNull();
    expect(
      formatOauthRedirectWarning({
        oauth_redirect_registered: true,
        oauth_redirect_origin: ORIGIN,
      }),
    ).toBeNull();
  });

  test('fills origin and reason when hosting omits them', () => {
    expect(formatOauthRedirectWarning({ oauth_redirect_registered: false })).toBe(
      "Sign-in won't work yet: this site wasn't added to allowed redirects. Hosting did not register the origin.",
    );
  });
});

describe('deployCommand oauth redirect warning', () => {
  beforeEach(() => {
    hostingFetch.mockReset();
    hostingUpload.mockReset();
  });

  afterEach(() => {
    for (const dir of projects) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    projects = [];
  });

  test('warns on preview and finalize without failing the deploy', async () => {
    mockHosting({
      preview: previewBody({
        oauth_redirect_registered: false,
        oauth_redirect_origin: ORIGIN,
        oauth_redirect_warning: REASON,
      }),
      finalize: finalizeBody({
        oauth_redirect_registered: false,
        oauth_redirect_origin: ORIGIN,
        oauth_redirect_warning: REASON,
      }),
    });

    const result = await runDeploy(makeProject());

    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.logs.some((line) => line.includes('Preview deploy complete.'))).toBe(true);
    expect(signInWarnings(result.warns)).toEqual([
      expect.stringContaining(WARNING),
      expect.stringContaining(WARNING),
    ]);
    expect(hostingUpload).toHaveBeenCalledOnce();
  });

  test('warns when only finalize reports a failed registration', async () => {
    mockHosting({
      preview: previewBody({
        oauth_redirect_registered: true,
        oauth_redirect_origin: ORIGIN,
      }),
      finalize: finalizeBody({
        oauth_redirect_registered: false,
        oauth_redirect_origin: ORIGIN,
        oauth_redirect_warning: REASON,
      }),
    });

    const result = await runDeploy(makeProject());

    expect(result.exitCode).toBe(0);
    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(signInWarnings(result.warns)).toEqual([expect.stringContaining(WARNING)]);
  });

  test('older hosting responses without the field deploy as before', async () => {
    mockHosting({
      preview: previewBody(),
      finalize: finalizeBody(),
    });

    const result = await runDeploy(makeProject());

    expect(result.exitCode).toBe(0);
    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(result.logs.some((line) => line.includes('Preview deploy complete.'))).toBe(true);
    expect(signInWarnings(result.warns)).toEqual([]);
  });

  test('a failed preview still fails the deploy', async () => {
    hostingFetch.mockResolvedValue({
      response: jsonResponse({ message: 'Forbidden' }, 403),
    });

    const result = await runDeploy(makeProject());

    expect(result.exitCode).toBe(1);
    expect(result.errors.some((line) => line.includes('Failed to prepare preview'))).toBe(true);
    expect(signInWarnings(result.warns)).toEqual([]);
    expect(hostingUpload).not.toHaveBeenCalled();
  });
});

describe('production deploys', () => {
  beforeEach(() => {
    hostingFetch.mockReset();
    hostingUpload.mockReset();
  });
  afterEach(() => {
    for (const dir of projects) fs.rmSync(dir, { recursive: true, force: true });
    projects = [];
  });

  function withApp(dir, app) {
    const p = path.join(dir, 'shellui.config.json');
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    cfg.hosting.app = app;
    fs.writeFileSync(p, JSON.stringify(cfg));
    return dir;
  }

  test('deploy --prod uses hosting.app and the production endpoint', async () => {
    hostingFetch.mockImplementation(async (_url, requestPath) => {
      if (requestPath === '/hosting/v1/apps/site/production') {
        return { response: jsonResponse({ slug: 'site', deployment: { id: 'dep-9' } }, 201) };
      }
      if (requestPath === '/hosting/v1/apps/site/deployments/dep-9/finalize') {
        return { response: jsonResponse({ id: 'dep-9', urls: { url: ORIGIN } }) };
      }
      throw new Error(`unexpected hosting path ${requestPath}`);
    });
    hostingUpload.mockResolvedValue({ response: jsonResponse({ ok: true }) });

    const result = await runDeploy(withApp(makeProject(), 'site'), { prod: true });

    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(result.logs.some((l) => l.includes('Production deploy complete.'))).toBe(true);
    expect(hostingUpload.mock.calls[0][1]).toBe('/hosting/v1/apps/site/deployments/dep-9/upload');
  });

  test('deploy --prod without hosting.app explains what to set', async () => {
    const result = await runDeploy(makeProject(), { prod: true });
    expect(result.exitCode).toBe(1);
    expect(result.errors.join('\n')).toContain('hosting.app');
    expect(hostingFetch).not.toHaveBeenCalled();
  });

  test('promote posts to the promote endpoint', async () => {
    hostingFetch.mockResolvedValue({
      response: jsonResponse({ id: 'dep-2', app_version: '1.0.0' }),
    });
    const dir = withApp(makeProject(), 'site');
    const result = await runDeploy(dir, {}, (root, options) =>
      promoteCommand('dep-2', root, options),
    );
    expect(result.errors).toEqual([]);
    expect(hostingFetch.mock.calls[0][1]).toBe('/hosting/v1/apps/site/deployments/dep-2/promote');
  });
});
