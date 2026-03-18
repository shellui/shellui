import { describe, expect, it } from 'vitest';
import type { Settings } from '@shellui/sdk';
import { getPreferenceSnapshot } from './getPreferenceSnapshot';

describe('getPreferenceSnapshot', () => {
  it('returns explicit preferences from settings', () => {
    const settings = {
      appearance: { name: 'blue', colorScheme: 'dark' },
      language: { code: 'fr' },
      region: { timezone: 'Europe/Paris' },
    } as Settings;

    expect(getPreferenceSnapshot(settings)).toEqual({
      themeName: 'blue',
      language: 'fr',
      region: 'Europe/Paris',
      colorScheme: 'dark',
    });
  });

  it('falls back to default values when settings fields are missing', () => {
    const settings = {
      appearance: { name: '', colorScheme: 'system' },
      language: { code: 'en' },
      region: { timezone: '' },
    } as Settings;

    const snapshot = getPreferenceSnapshot(settings);
    expect(snapshot.themeName).toBe('default');
    expect(snapshot.language).toBe('en');
    expect(snapshot.colorScheme).toBe('system');
    expect(typeof snapshot.region).toBe('string');
    expect(snapshot.region?.length).toBeGreaterThan(0);
  });
});
