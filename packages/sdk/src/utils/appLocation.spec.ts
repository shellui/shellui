/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  navigateApp,
  normalizeAppPath,
  readAppLocation,
  stripBasePath,
  subscribeAppLocation,
  withBasePath,
} from './appLocation.js';

describe('appLocation', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('strips and adds the base path', () => {
    expect(stripBasePath('/app/companies/1', '/app/')).toBe('/companies/1');
    expect(stripBasePath('/app', '/app/')).toBe('/');
    expect(stripBasePath('/application', '/app/')).toBe('/application');
    expect(withBasePath('/companies/1', '/app/')).toBe('/app/companies/1');
    expect(withBasePath('/x', '/')).toBe('/x');
  });

  it('refuses paths that could leave the document', () => {
    expect(() => withBasePath('//evil.example/x')).toThrow();
    expect(() => withBasePath('https://evil.example')).toThrow();
  });

  it('navigates relative to the base and notifies subscribers', () => {
    const listener = vi.fn();
    const off = subscribeAppLocation(listener);
    navigateApp('/companies/1/admin/users?p=2', { basePath: '/app/' });
    expect(window.location.pathname).toBe('/app/companies/1/admin/users');
    expect(readAppLocation('/app/').path).toBe('/companies/1/admin/users?p=2');
    expect(listener).toHaveBeenCalledOnce();
    navigateApp('/companies/1/admin/users?p=2', { basePath: '/app/' });
    expect(listener).toHaveBeenCalledOnce();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(listener).toHaveBeenCalledTimes(2);
    off();
  });
});

describe('normalizeAppPath', () => {
  it('spells each route one way', () => {
    expect(normalizeAppPath('')).toBe('/');
    expect(normalizeAppPath('/#/')).toBe('/');
    expect(normalizeAppPath('https://a.example/#')).toBe('https://a.example');
    expect(normalizeAppPath('https://a.example/')).toBe('https://a.example');
    expect(normalizeAppPath('/users/?page=2')).toBe('/users?page=2');
    expect(normalizeAppPath('/#/users/')).toBe('/#/users');
  });
});
