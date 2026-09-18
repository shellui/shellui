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
});
