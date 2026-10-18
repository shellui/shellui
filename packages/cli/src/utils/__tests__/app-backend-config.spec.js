import { describe, expect, it } from 'vitest';
import { validateConfig } from '../config-validate.js';

const item = {
  label: 'Directory',
  path: 'directory',
  url: 'https://directory.example/',
  safeForAuthToken: true,
};

describe('per-app backend config', () => {
  it('accepts a config with no per-app backend', () => {
    expect(() =>
      validateConfig({
        backend: { type: 'shellui', url: 'https://id.example.com' },
        navigation: [item],
      }),
    ).not.toThrow();
  });

  it('accepts a navigation item backend override', () => {
    expect(() =>
      validateConfig({
        backend: { type: 'shellui', url: 'https://id.example.com', companyId: 1 },
        navigation: [
          {
            ...item,
            backend: {
              url: 'https://id.directory.example',
              companyId: 4,
              provider: 'google',
            },
          },
        ],
        administration: {
          title: 'Tools',
          navigation: [
            {
              label: 'Other',
              path: 'other',
              url: 'https://other.example/',
              backend: { type: 'shellui', url: 'https://id.other.example' },
            },
          ],
        },
      }),
    ).not.toThrow();
  });

  it('rejects unknown backend fields', () => {
    expect(() =>
      validateConfig({
        navigation: [
          {
            ...item,
            backend: { url: 'https://id.directory.example', region: 'eu' },
          },
        ],
      }),
    ).toThrow(/additional property/);
  });
});
