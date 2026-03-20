import { describe, expect, it } from 'vitest';
import { getProviderVisual } from './getProviderVisual';

describe('getProviderVisual', () => {
  it('returns branded icon metadata for known providers', () => {
    const apple = getProviderVisual('apple');
    expect(apple.Icon).toBeTypeOf('function');
    expect(apple.iconClassName).toContain('dark:text-white');
    expect(apple.badgeClassName).toContain('bg-muted');

    const github = getProviderVisual('github');
    expect(github.Icon).toBeTypeOf('function');
    expect(github.iconClassName).toContain('text-[#24292F]');

    const linkedIn = getProviderVisual('linkedin_oidc');
    expect(linkedIn.Icon).toBeTypeOf('function');
    expect(linkedIn.iconClassName).toContain('text-[#0A66C2]');
  });

  it('returns fallback visual for unknown providers', () => {
    const fallback = getProviderVisual('custom');
    expect(fallback.Icon).toBeTypeOf('function');
    expect(fallback.iconClassName).toContain('text-primary');
    expect(fallback.badgeClassName).toContain('bg-primary/10');
  });
});
