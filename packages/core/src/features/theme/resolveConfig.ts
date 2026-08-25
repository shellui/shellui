import { defaultTheme, themes as curatedThemes } from './curated';
import { normalizeTheme } from './normalize';
import type { ThemeDefinition, ThemeInput, ThemeRef, ThemesConfig } from './types';

export interface ResolveThemeConfigInput {
  /** Single theme shorthand (name, path marker, or object). */
  theme?: ThemeRef;
  /** Multiple themes: array or map. */
  themes?: ThemesConfig;
  /** Preferred active theme id (takes precedence over defaultTheme). */
  activeTheme?: string;
  /** Legacy alias for activeTheme. */
  defaultTheme?: string;
  /**
   * Themes already loaded from `themesDir` by the CLI (complete definitions).
   * Keys are theme names.
   */
  themesFromDir?: Record<string, ThemeDefinition>;
  /**
   * Lookup for path-like refs that were preloaded by the CLI.
   * Key is the original path string from config.
   */
  pathThemes?: Record<string, ThemeDefinition>;
}

export interface ResolvedThemeConfig {
  /** Available themes for the app (selector + registry). */
  themes: ThemeDefinition[];
  /** Active / default theme name. */
  activeTheme: string;
  /** Same as activeTheme (legacy field written back into config). */
  defaultTheme: string;
}

function isPathRef(value: string): boolean {
  return (
    value.includes('/') ||
    value.includes('\\') ||
    value.endsWith('.json') ||
    value.startsWith('.') ||
    value.startsWith('~')
  );
}

function resolveStringRef(
  ref: string,
  builtins: Record<string, ThemeDefinition>,
  themesFromDir: Record<string, ThemeDefinition>,
  pathThemes: Record<string, ThemeDefinition>,
  mapKey?: string,
): ThemeDefinition {
  if (pathThemes[ref]) {
    const loaded = pathThemes[ref];
    return mapKey && loaded.name !== mapKey ? { ...loaded, name: mapKey } : loaded;
  }

  if (isPathRef(ref)) {
    throw new Error(
      `Theme path "${ref}" was not loaded. Use themesDir or ensure the CLI resolved this path.`,
    );
  }

  const fromDir = themesFromDir[ref];
  if (fromDir) {
    return mapKey && fromDir.name !== mapKey ? { ...fromDir, name: mapKey } : fromDir;
  }

  const builtin = builtins[ref];
  if (builtin) {
    return mapKey && builtin.name !== mapKey ? { ...builtin, name: mapKey } : builtin;
  }

  throw new Error(
    `Unknown theme "${ref}". Use a built-in name (${Object.keys(builtins).slice(0, 8).join(', ')}, …), a theme object, or a themesDir entry.`,
  );
}

function resolveRef(
  ref: ThemeRef,
  builtins: Record<string, ThemeDefinition>,
  themesFromDir: Record<string, ThemeDefinition>,
  pathThemes: Record<string, ThemeDefinition>,
  mapKey?: string,
): ThemeDefinition {
  if (typeof ref === 'string') {
    return resolveStringRef(ref, builtins, themesFromDir, pathThemes, mapKey);
  }
  return normalizeTheme(ref as ThemeInput, {
    name: mapKey,
    base: defaultTheme,
  });
}

function entriesFromThemesConfig(themes: ThemesConfig): Array<{ key?: string; ref: ThemeRef }> {
  if (Array.isArray(themes)) {
    return themes.map((ref) => ({ ref }));
  }
  return Object.entries(themes).map(([key, ref]) => ({ key, ref }));
}

/**
 * Resolve flexible theme config into a concrete theme list + active name.
 * Browser-safe (no filesystem). Path refs must be preloaded via `pathThemes` / `themesFromDir`.
 */
export function resolveThemeConfig(
  input: ResolveThemeConfigInput,
  builtins: Record<string, ThemeDefinition> = curatedThemes,
): ResolvedThemeConfig {
  const themesFromDir = input.themesFromDir ?? {};
  const pathThemes = input.pathThemes ?? {};
  const resolved: ThemeDefinition[] = [];
  const seen = new Set<string>();

  const add = (theme: ThemeDefinition) => {
    if (seen.has(theme.name)) {
      // Later entries override (e.g. custom overrides of a built-in name)
      const idx = resolved.findIndex((t) => t.name === theme.name);
      if (idx >= 0) resolved[idx] = theme;
      return;
    }
    seen.add(theme.name);
    resolved.push(theme);
  };

  if (input.themes != null) {
    for (const { key, ref } of entriesFromThemesConfig(input.themes)) {
      add(resolveRef(ref, builtins, themesFromDir, pathThemes, key));
    }
  } else if (input.theme != null) {
    add(resolveRef(input.theme, builtins, themesFromDir, pathThemes));
  } else if (Object.keys(themesFromDir).length > 0) {
    for (const theme of Object.values(themesFromDir)) {
      add(theme);
    }
  } else if (input.activeTheme || input.defaultTheme) {
    const name = (input.activeTheme || input.defaultTheme) as string;
    add(
      resolveStringRef(name === 'default' ? 'shellui' : name, builtins, themesFromDir, pathThemes),
    );
  } else {
    add(builtins.shellui ?? builtins.default ?? defaultTheme);
  }

  // Ensure default always exists as fallback when referenced
  if (!seen.has('default') && builtins.default) {
    // Don't auto-add to available list unless it was requested — only for getTheme fallbacks.
  }

  let preferred =
    input.activeTheme?.trim() ||
    input.defaultTheme?.trim() ||
    (typeof input.theme === 'string' && !isPathRef(input.theme) ? input.theme.trim() : '') ||
    (typeof input.theme === 'object' && input.theme && 'name' in input.theme
      ? String((input.theme as ThemeDefinition).name || '')
      : '') ||
    resolved[0]?.name ||
    'shellui';

  // Legacy init used theme: "default" — alias to official Shellui theme
  if (preferred === 'default') preferred = 'shellui';

  let activeTheme = preferred;
  if (!resolved.some((t) => t.name === activeTheme)) {
    // Active theme not in list — try to resolve and add it
    try {
      const extra = resolveStringRef(activeTheme, builtins, themesFromDir, pathThemes);
      add(extra);
    } catch {
      activeTheme = resolved[0]?.name ?? 'default';
      if (!resolved.length) {
        add(defaultTheme);
        activeTheme = defaultTheme.name;
      }
    }
  }

  return {
    themes: resolved,
    activeTheme,
    defaultTheme: activeTheme,
  };
}
