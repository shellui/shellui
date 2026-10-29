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
    const { session } = await hostingFetch(
      'https://hosting.test',
      '/hosting/v1/apps/a/production',
      {
        method: 'POST',
        body: {},
      },
    );
    expect(session).toBeNull();
    expect(loadValidSession).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  test('maps token error codes to clear messages', async () => {
    const revoked = await readHostingError(
      errorResponse(401, { error: 'deploy_token_revoked', message: 'x' }),
    );
    expect(revoked).toContain('was revoked');
    const wrong = await readHostingError(
      errorResponse(403, { error: 'deploy_token_wrong_app', message: 'x' }),
    );
    expect(wrong).toContain('hosting.app');
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
