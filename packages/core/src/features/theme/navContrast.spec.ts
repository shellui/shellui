// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { contrastRatio, isLowNavContrast, parseThemeColor } from './navContrast';
import { curatedThemes } from './themes';
import { applyTheme } from './applyTheme';

describe('navContrast', () => {
  it('parses oklch, hex and hsl', () => {
    expect(parseThemeColor('oklch(1 0 0)')).toEqual([1, 1, 1]);
    expect(parseThemeColor('#000000')).toEqual([0, 0, 0]);
    expect(parseThemeColor('0 0% 100%')?.map((n) => Math.round(n))).toEqual([1, 1, 1]);
    expect(parseThemeColor('hsl(0 0% 0%)')).toEqual([0, 0, 0]);
    expect(parseThemeColor('var(--x)')).toBeNull();
  });

  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('nope', '#ffffff')).toBeNull();
    expect(isLowNavContrast('nope', '#ffffff')).toBe(false);
  });

  it('keeps the solid pill on shellui and flags the low curated modes (37 from the audit, plus quantum-rose light at 4.497:1)', () => {
    const low: string[] = [];
    for (const theme of curatedThemes) {
      for (const mode of ['light', 'dark'] as const) {
        const c = theme.colors[mode];
        if (isLowNavContrast(c.sidebarPrimary, c.sidebarPrimaryForeground)) {
          low.push(`${theme.name}:${mode}`);
        }
      }
    }
    expect(low).not.toContain('shellui:light');
    expect(low).not.toContain('shellui:dark');
    expect(low).toContain('twitter:light');
    expect(low).toContain('amber-minimal:dark');
    expect(low).toContain('quantum-rose:light');
    expect(low).toHaveLength(38);
  });

  it('applyTheme sets and clears the attribute on <html>', () => {
    const twitter = curatedThemes.find((t) => t.name === 'twitter');
    const shellui = curatedThemes.find((t) => t.name === 'shellui');
    if (!twitter || !shellui) throw new Error('curated themes twitter and shellui are required');
    applyTheme({ ...twitter, fontFiles: [] }, false);
    expect(document.documentElement.getAttribute('data-shellui-nav-contrast')).toBe('low');
    applyTheme({ ...shellui, fontFiles: [] }, false);
    expect(document.documentElement.hasAttribute('data-shellui-nav-contrast')).toBe(false);
  });
});
