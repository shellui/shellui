import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShellUIConfig } from '../config/types';
import { isAllowedIframeOrigin, validateLoginPanelUrl } from './urlAllowlist';

const config = {
  backend: {
    type: 'shellui',
    url: 'https://api.example.com',
    loginUrl: 'https://app.example.com',
  },
  storage: {
    url: 'https://storage.example.com',
    filesUrl: 'https://files.example.com',
  },
} as ShellUIConfig;

describe('isAllowedIframeOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows the shell origin', () => {
    expect(
      isAllowedIframeOrigin('https://app.example.com', {
        currentOrigin: 'https://app.example.com',
      }),
    ).toBe(true);
  });

  it('allows configured backend and storage origins', () => {
    expect(isAllowedIframeOrigin('https://api.example.com', { config })).toBe(true);
    expect(isAllowedIframeOrigin('https://storage.example.com', { config })).toBe(true);
  });

  it('allows localhost in development builds', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(
      isAllowedIframeOrigin('http://localhost:5176', {
        allowLocalhost: true,
        currentOrigin: 'https://app.example.com',
      }),
    ).toBe(true);
  });

  it('denies localhost in production builds', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(
      isAllowedIframeOrigin('http://localhost:5176', {
        allowLocalhost: true,
        currentOrigin: 'https://app.example.com',
      }),
    ).toBe(false);
  });

  it('denies unrelated origins', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(
      isAllowedIframeOrigin('https://evil.example.com', {
        allowLocalhost: true,
        config,
        currentOrigin: 'https://app.example.com',
      }),
    ).toBe(false);
  });
});

describe('validateLoginPanelUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows same-origin relative paths', () => {
    expect(validateLoginPanelUrl('/login-branding/', config)).toBe('/login-branding/');
  });

  it('allows configured backend origin', () => {
    expect(validateLoginPanelUrl('https://api.example.com/branding/', config)).toBe(
      'https://api.example.com/branding/',
    );
  });

  it('allows localhost in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(validateLoginPanelUrl('http://localhost:5176/login-branding/', config)).toBe(
      'http://localhost:5176/login-branding/',
    );
  });

  it('rejects localhost in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(validateLoginPanelUrl('http://localhost:5176/login-branding/', config)).toBeNull();
  });

  it('rejects non-http(s) schemes and untrusted origins', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(validateLoginPanelUrl('javascript:alert(1)', config)).toBeNull();
    expect(validateLoginPanelUrl('https://evil.example.com/panel', config)).toBeNull();
  });
});
