import { describe, expect, it } from 'vitest';
import { getProviderVisual } from './getProviderVisual';

describe('getProviderVisual', () => {
  it('returns branded visuals for known providers', () => {
    expect(getProviderVisual('apple')).toEqual({
      iconText: 'A',
      iconClassName: 'bg-black text-white',
    });
    expect(getProviderVisual('github')).toEqual({
      iconText: 'GH',
      iconClassName: 'bg-[#24292F] text-white',
    });
    expect(getProviderVisual('linkedin_oidc')).toEqual({
      iconText: 'in',
      iconClassName: 'bg-[#0A66C2] text-white',
    });
  });

  it('returns fallback visual for unknown providers', () => {
    expect(getProviderVisual('custom')).toEqual({
      iconText: 'C',
      iconClassName: 'bg-primary text-primary-foreground',
    });
  });
});
