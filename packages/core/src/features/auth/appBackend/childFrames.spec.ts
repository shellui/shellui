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

describe('child frame service URLs', () => {
  const withServices: ShellUIConfig = {
    ...config,
    navigation: [
      {
        label: 'Dashboard',
        path: '',
        url: 'https://dashboard.example.com/',
        childFrames: {
          origins: ['https://admin.example.com'],
          backendOrigins: ['https://id.eu.example.com'],
          serviceOrigins: [
            'https://email.eu.example.com',
            'https://storage.eu.example.com',
            'https://files.example.com',
            'https://*.example.com',
            '*',
          ],
        },
      },
    ],
  };
  const register = (services: unknown, cfg: ShellUIConfig = withServices) =>
    validateChildFrameRegistration({
      from: ['h1'],
      hostSrc: host,
      payload: { ...good, services },
      config: cfg,
    });

  it('forwards allowed service URLs to the child settings', () => {
    const result = register({
      email: 'https://email.eu.example.com/',
      storage: 'https://storage.eu.example.com',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.services).toEqual({
      email: 'https://email.eu.example.com',
      storage: 'https://storage.eu.example.com',
      files: null,
      hosting: null,
    });
    expect(result.entry.rejectedServices).toEqual([]);
    const options = childFrameAuthPropagationOptions({
      identity: result.entry.identity,
      getAppSession: () => null,
      services: result.entry.services,
    });
    expect(options.email).toEqual({ url: 'https://email.eu.example.com' });
    expect(options.storage).toEqual({ url: 'https://storage.eu.example.com' });
    expect(options.hosting).toBeNull();
  });

  it('drops a service URL whose origin is not allowed', () => {
    const result = register({
      storage: 'https://evil.example.org',
      hosting: 'javascript:alert(1)',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.services).toEqual({
      email: null,
      storage: null,
      files: null,
      hosting: null,
    });
    expect(result.entry.rejectedServices).toEqual(['storage', 'hosting']);
  });

  it('forwards an allowed files URL as storage.filesUrl', () => {
    const result = register({
      storage: 'https://storage.eu.example.com',
      files: 'https://files.example.com/',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.services.files).toBe('https://files.example.com');
    const options = childFrameAuthPropagationOptions({
      identity: result.entry.identity,
      getAppSession: () => null,
      services: result.entry.services,
    });
    expect(options.storage).toEqual({
      url: 'https://storage.eu.example.com',
      filesUrl: 'https://files.example.com',
    });
  });

  it('drops a files URL whose origin is not allowed, or without storage', () => {
    const rejected = register({
      storage: 'https://storage.eu.example.com',
      files: 'https://files.evil.example.org',
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.entry.rejectedServices).toEqual(['files']);
    expect(
      childFrameAuthPropagationOptions({
        identity: null,
        getAppSession: () => null,
        services: rejected.entry.services,
      }).storage,
    ).toEqual({ url: 'https://storage.eu.example.com' });
    const alone = register({ files: 'https://files.example.com' });
    if (!alone.ok) throw new Error('expected ok');
    expect(
      childFrameAuthPropagationOptions({
        identity: null,
        getAppSession: () => null,
        services: alone.entry.services,
      }).storage,
    ).toBeNull();
  });

  it('never matches a wildcard entry', () => {
    const result = register({ hosting: 'https://hosting.example.com' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.services.hosting).toBeNull();
    expect(result.entry.rejectedServices).toEqual(['hosting']);
  });

  it('sends null for missing services, without falling back to the shell', () => {
    const shellWithServices: ShellUIConfig = {
      ...withServices,
      email: { url: 'https://email.example.com' },
      storage: { url: 'https://storage.example.com' },
      hosting: { url: 'https://hosting.example.com' },
    };
    const result = register(undefined, shellWithServices);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.services).toEqual({
      email: null,
      storage: null,
      files: null,
      hosting: null,
    });
    const options = childFrameAuthPropagationOptions({
      identity: result.entry.identity,
      getAppSession: () => null,
      services: result.entry.services,
    });
    expect(options).toMatchObject({ email: null, storage: null, hosting: null });
  });

  it('drops every service URL when serviceOrigins is not configured', () => {
    const result = register({ email: 'https://email.eu.example.com' }, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.services.email).toBeNull();
    expect(result.entry.rejectedServices).toEqual(['email']);
  });
});
