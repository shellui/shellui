import { describe, expect, it, beforeEach } from 'vitest';
import { hexToHsl, toCssVarValue, isHexColor } from './color';
import { normalizeTheme, toThemeJson } from './normalize';
import { resolveThemeConfig } from './resolveConfig';
import { clearThemeRegistry, getAllThemes, setAvailableThemes, getTheme } from './registry';
import {
  defaultTheme,
  themes,
  themeNames,
  curatedThemes,
  THEME_SCHEMA_VERSION,
  shelluiTheme,
  claudeTheme,
} from './themes';

describe('hexToHsl / toCssVarValue', () => {
  it('keeps hex as a full CSS color', () => {
    expect(toCssVarValue('#FFFFFF')).toBe('#FFFFFF');
    expect(toCssVarValue('000000')).toBe('#000000');
    expect(isHexColor('#22C55E')).toBe(true);
  });

  it('wraps legacy HSL channels and passes OKLCH through', () => {
    expect(toCssVarValue('142 71% 45%')).toBe('hsl(142 71% 45%)');
    expect(toCssVarValue('oklch(0.7 0.15 145)')).toBe('oklch(0.7 0.15 145)');
    expect(toCssVarValue('0.5rem')).toBe('0.5rem');
  });

  it('still converts hex to HSL channels via hexToHsl helper', () => {
    expect(hexToHsl('#FFFFFF')).toBe('0 0% 100%');
  });
});

describe('normalizeTheme', () => {
  it('merges partial light/dark onto the default theme', () => {
    const theme = normalizeTheme({
      name: 'brand',
      label: 'Brand',
      light: { primary: 'oklch(0.5 0.1 40)' },
      dark: { primary: 'oklch(0.6 0.1 40)' },
    });
    expect(theme.name).toBe('brand');
    expect(theme.displayName).toBe('Brand');
    expect(theme.colors.light.primary).toBe('oklch(0.5 0.1 40)');
    expect(theme.colors.light.background).toBe(defaultTheme.colors.light.background);
  });

  it('accepts CSS-variable kebab-case token keys', () => {
    const theme = normalizeTheme({
      name: 'kebab',
      label: 'Kebab',
      light: {
        'primary-foreground': 'oklch(1 0 0)',
        sidebar: 'oklch(0.9 0 0)',
      },
      dark: {
        'primary-foreground': 'oklch(0 0 0)',
        sidebar: 'oklch(0.2 0 0)',
      },
    });
    expect(theme.colors.light.primaryForeground).toBe('oklch(1 0 0)');
    expect(theme.colors.light.sidebarBackground).toBe('oklch(0.9 0 0)');
  });

  it('round-trips through toThemeJson', () => {
    const json = toThemeJson(defaultTheme);
    expect(json.version).toBe(THEME_SCHEMA_VERSION);
    expect(json.name).toBe('shellui');
    expect(json.label).toBe('Shellui');
    const again = normalizeTheme(json);
    expect(again.colors.light.primary).toBe(defaultTheme.colors.light.primary);
  });
});

describe('resolveThemeConfig', () => {
  it('resolves a single built-in theme by name', () => {
    const resolved = resolveThemeConfig({ theme: 'claude' });
    expect(resolved.themes).toHaveLength(1);
    expect(resolved.themes[0].name).toBe('claude');
    expect(resolved.activeTheme).toBe('claude');
  });

  it('resolves the curated themes', () => {
    const resolved = resolveThemeConfig({
      themes: [
        'shellui',
        'claude',
        'light-green',
        'zen-inspired',
        'astro-vista',
        'shadcn',
        'amber-minimal',
        'amethyst-haze',
        'bold-tech',
        'bubblegum',
        'caffeine',
        'candyland',
        'catppuccin',
        'claymorphism',
        'clean-slate',
        'cosmic-night',
        'cyberpunk',
        'darkmatter',
        'doom-64',
        'elegant-luxury',
        'graphite',
        'kodama-grove',
        'midnight-bloom',
        'mocha-mousse',
        'modern-minimal',
        'mono',
        'nature',
        'neo-brutalism',
        'northern-lights',
        'notebook',
        'ocean-breeze',
        'pastel-dreams',
        'perpetuity',
        'quantum-rose',
        'retro-arcade',
        'sage-garden',
        'soft-pop',
        'solar-dusk',
        'starry-night',
        'sunset-horizon',
        'supabase',
        't3-chat',
        'tangerine',
        'twitter',
        'vercel',
        'vintage-paper',
        'violet-bloom',
      ],
      activeTheme: 'shellui',
    });
    expect(resolved.themes.map((t) => t.name)).toEqual([
      'shellui',
      'claude',
      'light-green',
      'zen-inspired',
      'astro-vista',
      'shadcn',
      'amber-minimal',
      'amethyst-haze',
      'bold-tech',
      'bubblegum',
      'caffeine',
      'candyland',
      'catppuccin',
      'claymorphism',
      'clean-slate',
      'cosmic-night',
      'cyberpunk',
      'darkmatter',
      'doom-64',
      'elegant-luxury',
      'graphite',
      'kodama-grove',
      'midnight-bloom',
      'mocha-mousse',
      'modern-minimal',
      'mono',
      'nature',
      'neo-brutalism',
      'northern-lights',
      'notebook',
      'ocean-breeze',
      'pastel-dreams',
      'perpetuity',
      'quantum-rose',
      'retro-arcade',
      'sage-garden',
      'soft-pop',
      'solar-dusk',
      'starry-night',
      'sunset-horizon',
      'supabase',
      't3-chat',
      'tangerine',
      'twitter',
      'vercel',
      'vintage-paper',
      'violet-bloom',
    ]);
    expect(resolved.activeTheme).toBe('shellui');
  });

  it('defaults to the official Shellui theme', () => {
    const resolved = resolveThemeConfig({});
    expect(resolved.themes).toHaveLength(1);
    expect(resolved.activeTheme).toBe('shellui');
    expect(resolved.themes[0].name).toBe('shellui');
  });

  it('aliases default to shellui', () => {
    const resolved = resolveThemeConfig({ theme: 'default' });
    expect(resolved.themes[0].name).toBe('shellui');
  });
});

describe('registry', () => {
  beforeEach(() => {
    clearThemeRegistry();
  });

  it('exposes only configured available themes', () => {
    setAvailableThemes([themes.claude, themes.shellui]);
    expect(getAllThemes().map((t) => t.name)).toEqual(['claude', 'shellui']);
    expect(getTheme('claude')?.name).toBe('claude');
  });
});

describe('curated themes', () => {
  it('exports shellui as defaultTheme plus curated themes', () => {
    expect(defaultTheme.name).toBe('shellui');
    expect(shelluiTheme).toBe(defaultTheme);
    expect(claudeTheme.name).toBe('claude');
    expect(themeNames).toEqual([
      'shellui',
      'claude',
      'light-green',
      'zen-inspired',
      'astro-vista',
      'shadcn',
      'amber-minimal',
      'amethyst-haze',
      'bold-tech',
      'bubblegum',
      'caffeine',
      'candyland',
      'catppuccin',
      'claymorphism',
      'clean-slate',
      'cosmic-night',
      'cyberpunk',
      'darkmatter',
      'doom-64',
      'elegant-luxury',
      'graphite',
      'kodama-grove',
      'midnight-bloom',
      'mocha-mousse',
      'modern-minimal',
      'mono',
      'nature',
      'neo-brutalism',
      'northern-lights',
      'notebook',
      'ocean-breeze',
      'pastel-dreams',
      'perpetuity',
      'quantum-rose',
      'retro-arcade',
      'sage-garden',
      'soft-pop',
      'solar-dusk',
      'starry-night',
      'sunset-horizon',
      'supabase',
      't3-chat',
      'tangerine',
      'twitter',
      'vercel',
      'vintage-paper',
      'violet-bloom',
    ]);
    expect(curatedThemes).toHaveLength(47);
  });

  it('every curated theme uses OKLCH color values', () => {
    for (const theme of curatedThemes) {
      expect(theme.colors.light.primary.startsWith('oklch(')).toBe(true);
      expect(theme.colors.dark.primary.startsWith('oklch(')).toBe(true);
    }
  });
});
