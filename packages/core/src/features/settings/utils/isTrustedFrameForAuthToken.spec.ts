import { describe, expect, it } from 'vitest';
import type { ShellUIConfig } from '../../config/types';
import { isTrustedFrameForAuthToken } from './isTrustedFrameForAuthToken';

describe('isTrustedFrameForAuthToken', () => {
  const companionUrl = 'http://localhost:5173/';
  const frameSrc = 'http://localhost:5173/dashboard';

  it('does not trust navigation companions by default', () => {
    const config = {
      navigation: [
        {
          label: 'Companion',
          path: 'companion',
          url: companionUrl,
        },
      ],
    } as ShellUIConfig;

    expect(isTrustedFrameForAuthToken(frameSrc, config)).toBe(false);
  });

  it('trusts navigation companions when safeForAuthToken is true', () => {
    const config = {
      navigation: [
        {
          label: 'Companion',
          path: 'companion',
          url: companionUrl,
          safeForAuthToken: true,
        },
      ],
    } as ShellUIConfig;

    expect(isTrustedFrameForAuthToken(frameSrc, config)).toBe(true);
  });

  it('does not trust navigation companions when safeForAuthToken is false', () => {
    const config = {
      navigation: [
        {
          label: 'Companion',
          path: 'companion',
          url: companionUrl,
          safeForAuthToken: false,
        },
      ],
    } as ShellUIConfig;

    expect(isTrustedFrameForAuthToken(frameSrc, config)).toBe(false);
  });

  it('still trusts first-party admin and storage file explorer frames', () => {
    const config = {
      backend: {
        type: 'shellui',
        url: 'http://localhost:8000',
        adminUrl: 'http://localhost:5174/#/',
      },
      administration: {
        title: 'Admin',
        navigation: [
          {
            label: 'Billing',
            path: 'billing',
            url: 'http://localhost:5175/billing',
          },
        ],
      },
      storage: {
        url: 'http://localhost:8001/',
        filesUrl: 'http://localhost:5176/files',
      },
    } as ShellUIConfig;

    expect(isTrustedFrameForAuthToken('http://localhost:5174/#/users', config)).toBe(true);
    expect(isTrustedFrameForAuthToken('http://localhost:5175/billing/invoices', config)).toBe(true);
    expect(isTrustedFrameForAuthToken('http://localhost:5176/files/bucket', config)).toBe(true);
  });
});
