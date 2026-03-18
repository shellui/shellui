import { describe, expect, it } from 'vitest';
import { resolveLabel } from './resolveLabel';

describe('resolveLabel', () => {
  it('returns plain string labels unchanged', () => {
    expect(resolveLabel('Settings', 'en')).toBe('Settings');
  });

  it('returns translated label for requested language', () => {
    expect(resolveLabel({ en: 'Settings', fr: 'Parametres' }, 'fr')).toBe('Parametres');
  });

  it('falls back to english then first available label', () => {
    expect(resolveLabel({ en: 'Settings', fr: 'Parametres' }, 'de')).toBe('Settings');
    expect(resolveLabel({ en: '', fr: '', es: 'Configuracion' }, 'de')).toBe('');
  });
});
