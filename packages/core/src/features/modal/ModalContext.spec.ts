import { describe, expect, it } from 'vitest';
import { DEFAULT_ADMIN_URL } from '../admin/config';
import type { ShellUIConfig } from '../config/types';
import { validateAndNormalizeUrl } from './validateAndNormalizeUrl';

const config = {
  storage: {
    url: 'https://storage.example.com/',
    filesUrl: 'https://files.example.com/',
  },
  backend: {
    type: 'shellui',
    url: 'https://api.example.com',
    adminUrl: 'https://admin.example.com',
  },
  administration: {
    title: 'Apps',
    navigation: [
      {
        label: 'Billing',
        path: 'billing',
        url: 'https://billing.example.com/app',
      },
      {
        label: 'Django admin',
        path: 'django-admin',
        url: 'https://untrusted.example.com/admin',
        openIn: 'external',
      },
    ],
  },
} as ShellUIConfig;

describe('validateAndNormalizeUrl', () => {
  it('allows relative paths', () => {
    expect(validateAndNormalizeUrl('/settings')).toBe('/settings');
  });

  it('allows localhost urls', () => {
    expect(validateAndNormalizeUrl('http://localhost:5175/#/select')).toBe(
      'http://localhost:5175/#/select',
    );
  });

  it('rejects unrelated origins', () => {
    expect(validateAndNormalizeUrl('https://evil.example.com/form', config)).toBeNull();
  });

  it('allows storage.url and storage.filesUrl origins', () => {
    expect(validateAndNormalizeUrl('https://storage.example.com/storage/v1/quota', config)).toBe(
      'https://storage.example.com/storage/v1/quota',
    );
    expect(validateAndNormalizeUrl('https://files.example.com/#/select?mode=files', config)).toBe(
      'https://files.example.com/#/select?mode=files',
    );
  });

  it('allows the configured administration adminUrl', () => {
    expect(validateAndNormalizeUrl('https://admin.example.com/#/users', config)).toBe(
      'https://admin.example.com/#/users',
    );
    expect(validateAndNormalizeUrl(`${DEFAULT_ADMIN_URL}/#/users`, config)).toBeNull();
  });

  it('allows the default administration url when adminUrl is not configured', () => {
    expect(validateAndNormalizeUrl(`${DEFAULT_ADMIN_URL}/#/dashboard`)).toBe(
      `${DEFAULT_ADMIN_URL}/#/dashboard`,
    );
  });

  it('allows administration navigation urls but not external ones', () => {
    expect(validateAndNormalizeUrl('https://billing.example.com/app/#/invoices', config)).toBe(
      'https://billing.example.com/app/#/invoices',
    );
    expect(validateAndNormalizeUrl('https://untrusted.example.com/admin', config)).toBeNull();
  });
});
