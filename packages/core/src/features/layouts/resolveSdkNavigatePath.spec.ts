import { describe, expect, it } from 'vitest';
import urls from '../../../constants/urls';
import { DEFAULT_ADMIN_URL } from '../../admin/config';
import type { NavigationItem, ShellUIConfig } from '../../config/types';
import { resolveSdkNavigatePath } from './resolveSdkNavigatePath';

const navItems: NavigationItem[] = [
  {
    label: 'Docs',
    path: 'docs',
    url: 'https://docs.shellui.com',
  },
  {
    label: 'Themes',
    path: 'themes',
    url: 'http://localhost:8000/app/#/themes',
    useHashRouter: true,
  },
];

const config: ShellUIConfig = {
  backend: {
    type: 'shellui',
    url: 'http://localhost:8000',
    adminPathname: '/admin',
  },
};

describe('resolveSdkNavigatePath', () => {
  it('allows built-in shell routes', () => {
    expect(resolveSdkNavigatePath('/admin', config, navItems)).toBe('/admin');
    expect(resolveSdkNavigatePath(urls.login, config, navItems)).toBe(urls.login);
    expect(resolveSdkNavigatePath(urls.settings, config, navItems)).toBe(urls.settings);
  });

  it('allows configured navigation paths', () => {
    expect(resolveSdkNavigatePath('/docs', config, navItems)).toBe('/docs');
    expect(resolveSdkNavigatePath('/themes/foo', config, navItems)).toBe('/themes/foo');
  });

  it('rejects external and absolute URLs', () => {
    expect(resolveSdkNavigatePath(DEFAULT_ADMIN_URL, config, navItems)).toBeNull();
    expect(resolveSdkNavigatePath(`${DEFAULT_ADMIN_URL}/#/users`, config, navItems)).toBeNull();
    expect(resolveSdkNavigatePath('https://docs.shellui.com/page', config, navItems)).toBeNull();
    expect(
      resolveSdkNavigatePath('http://localhost:8000/app/#/themes/colors', config, navItems),
    ).toBeNull();
    expect(resolveSdkNavigatePath('https://evil.example.com', config, navItems)).toBeNull();
    expect(resolveSdkNavigatePath('//evil.example.com/path', config, navItems)).toBeNull();
  });

  it('rejects unconfigured relative paths', () => {
    expect(resolveSdkNavigatePath('/not-configured', config, navItems)).toBeNull();
  });
});
