import { describe, expect, it } from 'vitest';
import { deriveAllowedMessageOrigins } from './deriveAllowedMessageOrigins';
import type { ShellUIConfig } from '../config/types';

describe('deriveAllowedMessageOrigins', () => {
  it('collects origins from navigation, storage, and admin URLs', () => {
    const config = {
      navigation: [
        {
          label: 'App',
          path: 'app',
          url: 'http://localhost:3000/',
        },
        {
          title: 'Group',
          items: [
            {
              label: 'Files',
              path: 'files',
              url: 'https://files.example.com/app/',
            },
          ],
        },
      ],
      storage: {
        url: 'https://storage.example.com',
        filesUrl: 'https://files.example.com/explorer/',
      },
      administration: {
        navigation: [
          {
            label: 'Admin app',
            path: 'admin-app',
            url: 'https://admin.example.com/panel/',
          },
        ],
      },
    } as ShellUIConfig;

    const origins = deriveAllowedMessageOrigins(config);
    expect(origins).toContain('http://localhost:3000');
    expect(origins).toContain('https://admin.example.com');
    expect(origins).toContain('https://files.example.com');
    expect(origins).toContain('https://storage.example.com');
  });

  it('unions security.allowedMessageOrigins with derived origins', () => {
    const config = {
      navigation: [{ label: 'App', path: 'app', url: 'http://localhost:3000/' }],
      security: {
        allowedMessageOrigins: ['https://preview.example.com', 'http://127.0.0.1:4173/preview/'],
      },
    } as ShellUIConfig;

    const origins = deriveAllowedMessageOrigins(config);
    expect(origins).toContain('http://localhost:3000');
    expect(origins).toContain('https://preview.example.com');
    expect(origins).toContain('http://127.0.0.1:4173');
  });

  it('keeps derive-only behavior when security.allowedMessageOrigins is empty or omitted', () => {
    const base = {
      navigation: [{ label: 'App', path: 'app', url: 'http://localhost:3000/' }],
    } as ShellUIConfig;

    const derivedOnly = deriveAllowedMessageOrigins(base);
    expect(derivedOnly).toContain('http://localhost:3000');
    expect(
      deriveAllowedMessageOrigins({ ...base, security: { allowedMessageOrigins: [] } }),
    ).toEqual(derivedOnly);
  });

  it('skips invalid security.allowedMessageOrigins entries without throwing', () => {
    const config = {
      navigation: [{ label: 'App', path: 'app', url: 'http://localhost:3000/' }],
      security: {
        allowedMessageOrigins: ['https://preview.example.com', 'javascript:alert(1)', '', 42],
      },
    } as unknown as ShellUIConfig;

    const origins = deriveAllowedMessageOrigins(config);
    expect(origins).toContain('http://localhost:3000');
    expect(origins).toContain('https://preview.example.com');
    expect(origins).not.toContain('javascript:alert(1)');
  });
});
