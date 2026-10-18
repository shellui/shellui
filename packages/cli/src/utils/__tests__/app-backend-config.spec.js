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

  it('accepts per-app email, storage, and hosting', () => {
    expect(() =>
      validateConfig({
        backend: { type: 'shellui', url: 'https://id.example.com' },
        email: { url: 'https://email.example' },
        storage: { url: 'https://files-api.example' },
        hosting: { url: 'https://hosting.example' },
        navigation: [
          {
            ...item,
            backend: { url: 'https://id.directory.example' },
            email: {},
            storage: {
              url: 'https://files-api.directory.example',
              filesUrl: 'https://files.directory.example/',
            },
            hosting: { url: 'https://hosting.directory.example', showInAdmin: false },
          },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects unknown service fields on a navigation item', () => {
    expect(() =>
      validateConfig({
        navigation: [
          {
            ...item,
            email: { url: 'https://email.directory.example', region: 'eu' },
          },
        ],
      }),
    ).toThrow(/additional property/);
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
