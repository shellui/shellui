import { describe, expect, it } from 'vitest';
import { withShellSearch } from './useNavigationItems';

describe('withShellSearch', () => {
  it('keeps the deep-link query', () => {
    expect(withShellSearch('/app/users/7', '?tab=x')).toBe('/app/users/7?tab=x');
    expect(withShellSearch('https://a.example/x?a=1', '?b=2')).toBe('https://a.example/x?a=1&b=2');
    expect(withShellSearch('https://a.example/#/users', '?b=2')).toBe(
      'https://a.example/?b=2#/users',
    );
    expect(withShellSearch('/app', '')).toBe('/app');
  });
});
