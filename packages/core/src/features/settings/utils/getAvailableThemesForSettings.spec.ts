import { describe, expect, it } from 'vitest';
import { getAvailableThemesForSettings } from './getAvailableThemesForSettings';

describe('getAvailableThemesForSettings', () => {
  it('returns registered themes in the lightweight settings shape', () => {
    const themes = getAvailableThemesForSettings();

    expect(themes.length).toBeGreaterThan(0);
    expect(themes[0]).toMatchObject({
      name: expect.any(String),
      displayName: expect.any(String),
      colors: expect.any(Object),
    });
  });
});
