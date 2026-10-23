import { afterEach, describe, expect, it } from 'vitest';
import type { ShellUIConfig } from '../../config/types';
import {
  addChildFrame,
  clearChildFrames,
  findChildFrame,
  listChildFrames,
  removeChildFrame,
  validateChildFrameRegistration,
} from './childFrames';
import { childFrameAuthPropagationOptions } from './frameAuth';
import type { AuthSession } from '../types';

const config: ShellUIConfig = {
  backend: { type: 'shellui', url: 'https://id.example.com', companyId: 1 },
  navigation: [
    {
      label: 'Dashboard',
      path: '',
      url: 'https://dashboard.example.com/',
      safeForAuthToken: true,
      childFrames: {
        origins: ['https://admin.example.com', 'https://*.example.com', '*'],
        backendOrigins: ['https://id.eu.example.com'],
      },
    },
    { label: 'Other', path: 'other', url: 'https://other.example.com/' },
  ],
};

const host = 'https://dashboard.example.com/';
const good = {
  frameId: 'child-1',
  url: 'https://admin.example.com/companies?x=1',
  backend: { url: 'https://id.eu.example.com', companyId: 'abc' },
};

afterEach(() => clearChildFrames());

describe('validateChildFrameRegistration', () => {
  it('accepts an allowed child and backend', () => {
    const result = validateChildFrameRegistration({
      from: ['h1'],
      hostSrc: host,
      payload: good,
      config,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.hostUuid).toBe('h1');
    expect(result.entry.identity?.url).toBe('https://id.eu.example.com');
    expect(result.entry.identity?.companyId).toBe('abc');
  });

  it('rejects a message relayed from deeper than one hop', () => {
    const result = validateChildFrameRegistration({
      from: ['h1', 'child'],
      hostSrc: host,
      payload: good,
      config,
    });
    expect(result).toEqual({ ok: false, reason: 'not sent by a direct app frame' });
  });

  it('rejects hosts without childFrames', () => {
    const result = validateChildFrameRegistration({
      from: ['h1'],
      hostSrc: 'https://other.example.com/',
      payload: good,
      config,
    });
    expect(result.ok).toBe(false);
  });

  it('only matches exact origins, never wildcards', () => {
    for (const url of [
      'https://evil.example.com/',
      'https://admin.example.com.evil.io/',
      'javascript:alert(1)',
    ]) {
      const result = validateChildFrameRegistration({
        from: ['h1'],
        hostSrc: host,
        payload: { ...good, url },
        config,
      });
      expect(result.ok).toBe(false);
    }
  });

  it('rejects a backend that is not allowlisted', () => {
    const result = validateChildFrameRegistration({
      from: ['h1'],
      hostSrc: host,
      payload: { ...good, backend: { url: 'https://id.example.com' } },
      config,
    });
    expect(result).toEqual({ ok: false, reason: 'child identity server is not allowed' });
  });

  it('accepts a child without backend and gives it no identity', () => {
    const result = validateChildFrameRegistration({
      from: ['h1'],
      hostSrc: host,
      payload: { ...good, backend: null },
      config,
    });
    expect(result.ok && result.entry.identity).toBeNull();
  });
});

describe('child frame registry', () => {
  it('finds by host and child path, and drops entries for gone hosts', () => {
    const result = validateChildFrameRegistration({
      from: ['h1'],
      hostSrc: host,
      payload: good,
      config,
    });
    if (!result.ok) throw new Error(result.reason);
    addChildFrame(result.entry);
    expect(findChildFrame(['h1', 'child-1'])).toBe(result.entry);
    expect(findChildFrame(['h1'])).toBeNull();
    expect(findChildFrame(['h2', 'child-1'])).toBeNull();
    expect(listChildFrames(() => false)).toEqual([]);
    expect(findChildFrame(['h1', 'child-1'])).toBeNull();
    addChildFrame(result.entry);
    removeChildFrame('h1', 'child-1');
    expect(findChildFrame(['h1', 'child-1'])).toBeNull();
  });
});

describe('childFrameAuthPropagationOptions', () => {
  const session = {
    accessToken: 'regional-token',
    refreshToken: 'r',
    expiresAt: 9999999999,
    userId: 'u1',
    userEmail: 'a@b.c',
    userName: 'A',
  } as AuthSession;

  it('sends the regional session and backend, and no shared services', () => {
    const result = validateChildFrameRegistration({
      from: ['h1'],
      hostSrc: host,
      payload: good,
      config,
    });
    if (!result.ok) throw new Error(result.reason);
    const options = childFrameAuthPropagationOptions({
      identity: result.entry.identity,
      getAppSession: (key) => (key === result.entry.identity?.key ? session : null),
    });
    expect(options.accessToken).toBe('regional-token');
    expect(options.authBackendBaseUrl).toBe('https://id.eu.example.com');
    expect(options.settingsUser?.id).toBe('u1');
    expect(options.storage).toBeNull();
    expect(options.email).toBeNull();
    expect(options.hosting).toBeNull();
  });

  it('sends no token when the child has no identity', () => {
    const options = childFrameAuthPropagationOptions({
      identity: null,
      getAppSession: () => session,
    });
    expect(options.accessToken).toBeNull();
    expect(options.includeAuthAccessToken).toBe(false);
    expect(options.settingsUser).toBeNull();
  });
});
