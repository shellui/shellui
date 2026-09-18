import { describe, expect, it } from 'vitest';
import type { ShellUIConfig } from '../config/types';
import {
  getStorageRequestTrustDenial,
  isRegisteredTrustedFrame,
  isTrustedFrameForAuthToken,
  resolveRegisteredFrameSrc,
} from './trustedFrames';

const config = {
  navigation: [
    {
      label: 'Companion',
      path: 'companion',
      url: 'http://localhost:5175/',
      safeForAuthToken: true,
    },
    {
      label: 'Default companion',
      path: 'default',
      url: 'http://localhost:5198/',
    },
    {
      label: 'Hostile embed',
      path: 'hostile',
      url: 'http://localhost:5199/',
      safeForAuthToken: false,
    },
  ],
  storage: {
    url: 'http://localhost:8001',
    filesUrl: 'http://localhost:5176/',
  },
  administration: {
    title: 'Admin',
    navigation: [
      {
        label: 'Billing',
        path: 'billing',
        url: 'http://localhost:5180/app',
      },
    ],
  },
} as ShellUIConfig;

const trustedIframe = {
  src: 'http://localhost:5175/company/docs',
} as HTMLIFrameElement;

const defaultIframe = {
  src: 'http://localhost:5198/widget',
} as HTMLIFrameElement;

const hostileIframe = {
  src: 'http://localhost:5199/widget',
} as HTMLIFrameElement;

const registry = {
  getAllIframes: () =>
    [
      ['trusted-uuid', trustedIframe],
      ['default-uuid', defaultIframe],
      ['hostile-uuid', hostileIframe],
    ] as Array<[string, HTMLIFrameElement]>,
};

describe('isTrustedFrameForAuthToken', () => {
  it('does not trust navigation companions by default', () => {
    expect(isTrustedFrameForAuthToken('http://localhost:5198/widget', config)).toBe(false);
  });

  it('allows navigation companions with safeForAuthToken: true', () => {
    expect(isTrustedFrameForAuthToken('http://localhost:5175/company', config)).toBe(true);
  });

  it('denies navigation items marked safeForAuthToken: false', () => {
    expect(isTrustedFrameForAuthToken('http://localhost:5199/widget', config)).toBe(false);
  });

  it('allows administration navigation and storage files explorer frames', () => {
    expect(isTrustedFrameForAuthToken('http://localhost:5180/app/#/invoices', config)).toBe(true);
    expect(isTrustedFrameForAuthToken('http://localhost:5176/#/select', config)).toBe(true);
  });

  it('denies unrelated origins', () => {
    expect(isTrustedFrameForAuthToken('https://evil.example.com/payload', config)).toBe(false);
  });
});

describe('resolveRegisteredFrameSrc', () => {
  it('returns the src for a registered iframe uuid', () => {
    expect(resolveRegisteredFrameSrc(['trusted-uuid'], registry)).toBe(
      'http://localhost:5175/company/docs',
    );
  });

  it('returns null when the sender is not registered', () => {
    expect(resolveRegisteredFrameSrc(['unknown-uuid'], registry)).toBeNull();
    expect(resolveRegisteredFrameSrc(undefined, registry)).toBeNull();
  });
});

describe('getStorageRequestTrustDenial', () => {
  it('allows trusted companion frames', () => {
    expect(getStorageRequestTrustDenial(['trusted-uuid'], registry, config)).toBeNull();
    expect(isRegisteredTrustedFrame('http://localhost:5175/company', config)).toBe(true);
  });

  it('denies default (non-opt-in) companion frames', () => {
    expect(getStorageRequestTrustDenial(['default-uuid'], registry, config)).toEqual({
      message: 'Storage request rejected: untrusted frame',
      status: 403,
    });
  });

  it('denies hostile iframe requests without storage I/O', () => {
    expect(getStorageRequestTrustDenial(['hostile-uuid'], registry, config)).toEqual({
      message: 'Storage request rejected: untrusted frame',
      status: 403,
    });
  });

  it('denies unregistered senders', () => {
    expect(getStorageRequestTrustDenial(['missing-uuid'], registry, config)).toEqual({
      message: 'Storage request rejected: untrusted frame',
      status: 403,
    });
  });
});
