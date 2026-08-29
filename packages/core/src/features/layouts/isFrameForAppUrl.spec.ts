import { describe, expect, it } from 'vitest';
import { isFrameForAppUrl } from './utils';

describe('isFrameForAppUrl', () => {
  it('matches same origin site-root app and deep-linked iframe paths', () => {
    const app = 'http://localhost:5175/';
    expect(isFrameForAppUrl('http://localhost:5175/', app)).toBe(true);
    expect(isFrameForAppUrl('http://localhost:5175/company', app)).toBe(true);
    expect(isFrameForAppUrl('http://localhost:5175/company/Test', app)).toBe(true);
  });

  it('matches nested app base paths', () => {
    const app = 'https://files.example.com/app/';
    expect(isFrameForAppUrl('https://files.example.com/app', app)).toBe(true);
    expect(isFrameForAppUrl('https://files.example.com/app/company/docs', app)).toBe(true);
    expect(isFrameForAppUrl('https://files.example.com/other/company', app)).toBe(false);
  });

  it('rejects other origins', () => {
    expect(isFrameForAppUrl('http://localhost:5176/company', 'http://localhost:5175/')).toBe(false);
  });

  it('matches hash-router prefixes when the app URL includes a hash', () => {
    const app = 'http://localhost:5174/#/';
    expect(isFrameForAppUrl('http://localhost:5174/#/users', app)).toBe(true);
    expect(
      isFrameForAppUrl('http://localhost:5174/#/themes/foo', 'http://localhost:5174/#/themes'),
    ).toBe(true);
    expect(
      isFrameForAppUrl('http://localhost:5174/#/other', 'http://localhost:5174/#/themes'),
    ).toBe(false);
  });
});
