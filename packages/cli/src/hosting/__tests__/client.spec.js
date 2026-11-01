import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../auth/session.js', () => ({
  loadValidSession: vi.fn(async () => null),
  refreshSession: vi.fn(),
}));

import { loadValidSession } from '../../auth/session.js';
import { hostingFetch, readHostingError, redactDeployToken } from '../client.js';

const TOKEN = 'shellui_dt_abcDEF123_-xyz';

function errorResponse(status, body) {
  return { ok: false, status, json: async () => body };
}

describe('hosting client with SHELLUI_DEPLOY_TOKEN', () => {
  beforeEach(() => {
    process.env.SHELLUI_DEPLOY_TOKEN = TOKEN;
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200 }));
  });
  afterEach(() => {
    delete process.env.SHELLUI_DEPLOY_TOKEN;
    vi.clearAllMocks();
  });

  test('sends the token as bearer and skips the login session', async () => {
    const { session } = await hostingFetch('https://hosting.test', '/hosting/v1/preview', {
      method: 'POST',
      body: {},
    });
    expect(session).toBeNull();
    expect(loadValidSession).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  test('maps token error codes to clear messages', async () => {
    const revoked = await readHostingError(
      errorResponse(401, { error: 'deploy_token_revoked', message: 'x' }),
    );
    expect(revoked).toContain('was revoked');
    const previewOnly = await readHostingError(
      errorResponse(403, { error: 'deploy_token_preview_only', message: 'x' }),
    );
    expect(previewOnly).toContain('preview');
    const expired = await readHostingError(
      errorResponse(401, { error: 'deploy_token_expired', message: 'x' }),
    );
    expect(expired).toContain('expired');
  });

  test('never echoes the token in errors', async () => {
    const message = await readHostingError(errorResponse(400, { message: `bad ${TOKEN}` }));
    expect(message).not.toContain(TOKEN);
    expect(redactDeployToken(`a ${TOKEN} b`)).toBe('a shellui_dt_*** b');
  });
});

describe('hosting client without a token', () => {
  test('asks for login or a deploy token', async () => {
    delete process.env.SHELLUI_DEPLOY_TOKEN;
    await expect(hostingFetch('https://hosting.test', '/x')).rejects.toThrow(
      /shellui login.*SHELLUI_DEPLOY_TOKEN/,
    );
  });
});

describe('readHostingError causes', () => {
  const text = (status, body) => ({ ok: false, status, text: async () => body });

  test('prints detail from JSON', async () => {
    const msg = await readHostingError(
      text(413, JSON.stringify({ detail: 'Artifact is 120 MB, the limit is 100 MB.' })),
    );
    expect(msg).toBe('Artifact is 120 MB, the limit is 100 MB.');
  });

  test('adds artifact size to a too large error without sizes', async () => {
    const msg = await readHostingError(
      text(413, JSON.stringify({ error: 'x', message: 'Too large', limit_bytes: 12 * 1024 ** 2 })),
      {
        artifactSize: 12995000,
      },
    );
    expect(msg).toBe('Too large (artifact is 12.4 MB, the limit is 12 MB)');
  });

  test('falls back to plain text, stripping HTML', async () => {
    const msg = await readHostingError(text(400, '<h1>Bad Request (400)</h1>'));
    expect(msg).toBe('Bad Request (400)');
  });

  test('redacts tokens in plain text', async () => {
    const msg = await readHostingError(text(500, `oops ${TOKEN}`));
    expect(msg).not.toContain(TOKEN);
  });
});
