import path from 'path';
import fs from 'fs';
import Ajv from 'ajv';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import pc from 'picocolors';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const THEME_SCHEMA_VERSION = 1;

const THEME_COLOR_KEYS = [
  'background',
  'foreground',
  'card',
  'cardForeground',
  'popover',
  'popoverForeground',
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'muted',
  'mutedForeground',
  'accent',
  'accentForeground',
  'destructive',
  'destructiveForeground',
  'border',
  'input',
  'ring',
  'radius',
  'sidebarBackground',
  'sidebarForeground',
  'sidebarPrimary',
  'sidebarPrimaryForeground',
  'sidebarAccent',
  'sidebarAccentForeground',
  'sidebarBorder',
  'sidebarRing',
];

let cachedThemeValidate = null;
let cachedBuiltins = null;

/**
 * Resolve path to shellui.theme.schema.json
 * @returns {string}
 */
export function resolveThemeSchemaPath() {
  try {
    return require.resolve('@shellui/core/schemas/shellui.theme.schema.json');
  } catch {
    const candidate = path.resolve(__dirname, '../../../core/schemas/shellui.theme.schema.json');
    if (fs.existsSync(candidate)) return candidate;
    throw new Error('Could not resolve Shellui theme JSON schema.');
  }
}

/**
 * Resolve path to curated-themes.json
 * @returns {string}
 */
export function resolveCuratedThemesPath() {
  try {
    return require.resolve('@shellui/core/schemas/curated-themes.json');
  } catch {
    const candidates = [
      path.resolve(__dirname, '../../../core/schemas/curated-themes.json'),
      path.resolve(__dirname, '../../../../core/schemas/curated-themes.json'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(
      'Could not resolve curated-themes.json. Run pnpm --filter @shellui/core run generate:curated-themes',
    );
  }
}

/**
 * @returns {import('ajv').ValidateFunction}
 */
export function getThemeValidator() {
  if (cachedThemeValidate) return cachedThemeValidate;
  const schema = JSON.parse(fs.readFileSync(resolveThemeSchemaPath(), 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
  cachedThemeValidate = ajv.compile(schema);
  return cachedThemeValidate;
}

/**
 * Load curated built-in themes as a name → ThemeDefinition map.
 * @returns {Record<string, object>}
 */
export function loadBuiltinThemes() {
  if (cachedBuiltins) return cachedBuiltins;
  const raw = JSON.parse(fs.readFileSync(resolveCuratedThemesPath(), 'utf8'));
  const map = {};
  for (const input of raw.themes || []) {
    const theme = normalizeTheme(input);
    map[theme.name] = theme;
  }
  // Alias for older configs / init that used theme: "default"
  if (map.shellui && !map.default) {
    map.default = map.shellui;
  }
  cachedBuiltins = map;
  return map;
}

function isCompleteMode(mode) {
  if (!mode || typeof mode !== 'object') return false;
  return THEME_COLOR_KEYS.every((key) => typeof mode[key] === 'string' && mode[key].length > 0);
}

function mergeMode(base, override, radiusFallback) {
  const merged = { ...base, ...(override || {}) };
  if (radiusFallback && (!override?.radius || override.radius === '')) {
    merged.radius = radiusFallback;
  }
  return merged;
}

/**
 * Normalize a flexible theme object into a complete ThemeDefinition.
 * @param {object} input
 * @param {{ name?: string, base?: object }} [options]
 */
export function normalizeTheme(input, options = {}) {
  if (
    input?.colors &&
    isCompleteMode(input.colors.light) &&
    isCompleteMode(input.colors.dark) &&
    typeof input.name === 'string' &&
    typeof input.displayName === 'string'
  ) {
    return {
      ...input,
      name: options.name || input.name,
      displayName: input.displayName || input.label || input.name,
    };
  }

  if (input?.version != null && input.version !== THEME_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported theme version ${input.version}. Expected ${THEME_SCHEMA_VERSION}.`,
    );
  }

  const name = (options.name || input.name || '').trim();
  if (!name) {
    throw new Error('Theme object requires a `name` (or map key / filename).');
  }
  const displayName = input.label || input.displayName || name;
  const lightPartial = input.light || input.colors?.light;
  const darkPartial = input.dark || input.colors?.dark;

  let light;
  let dark;
  if (isCompleteMode(lightPartial) && isCompleteMode(darkPartial)) {
    light = { ...lightPartial };
    dark = { ...darkPartial };
    if (input.radius) {
      light.radius = light.radius || input.radius;
      dark.radius = dark.radius || input.radius;
    }
  } else {
    const builtins = cachedBuiltins || {};
    const base = options.base || builtins.default;
    if (!base?.colors?.light || !base?.colors?.dark) {
      throw new Error(
        `Cannot normalize partial theme "${name}" without a base theme. Provide full light/dark tokens or ensure curated themes are loaded.`,
      );
    }
    light = mergeMode(base.colors.light, lightPartial, input.radius);
    dark = mergeMode(base.colors.dark, darkPartial, input.radius);
  }

  const fonts = input.fonts;
  const bodyFontFamily = input.bodyFontFamily || fonts?.body || fonts?.sans || input.fontFamily;
  const headingFontFamily =
    input.headingFontFamily || fonts?.heading || fonts?.sans || input.fontFamily;
  const fontFamily = input.fontFamily || fonts?.sans || bodyFontFamily;
  const fontFiles = input.fontFiles || fonts?.files;

  return {
    name,
    displayName,
    ...(input.description ? { description: input.description } : {}),
    ...(input.recommended ? { recommended: true } : {}),
    colors: { light, dark },
    ...(fontFamily ? { fontFamily } : {}),
    ...(bodyFontFamily ? { bodyFontFamily } : {}),
    ...(headingFontFamily ? { headingFontFamily } : {}),
    ...(fontFiles?.length ? { fontFiles: [...fontFiles] } : {}),
    ...(input.letterSpacing ? { letterSpacing: input.letterSpacing } : {}),
    ...(input.textShadow ? { textShadow: input.textShadow } : {}),
    ...(input.lineHeight ? { lineHeight: input.lineHeight } : {}),
  };
}

/**
 * Validate a theme JSON object against shellui.theme.schema.json.
 * Theme folder files must include version + name + light/dark (or colors).
 * @param {unknown} theme
 * @param {{ source?: string, requireVersion?: boolean }} [options]
 */
export function validateThemeJson(theme, options = {}) {
  const requireVersion = options.requireVersion !== false;
  if (requireVersion) {
    const validate = getThemeValidator();
    const { $schema: _s, ...rest } =
      theme && typeof theme === 'object' && !Array.isArray(theme) ? theme : {};
    const valid = validate(rest);
    if (!valid) {
      const lines = (validate.errors || []).map((err) => {
        const p = err.instancePath || '/';
        if (err.params?.additionalProperty) {
          return `${p}: must NOT have additional property '${err.params.additionalProperty}'`;
        }
        return `${p} ${err.message || 'is invalid'}`;
      });
      const source = options.source ? ` (${options.source})` : '';
      const err = new Error(
        `Invalid Shellui theme${source}:\n` + lines.map((l) => `  - ${l}`).join('\n'),
      );
      err.code = 'THEME_VALIDATION';
      throw err;
    }
    return rest;
  }
  return theme;
}

function isPathRef(value) {
  return (
    value.includes('/') ||
    value.includes('\\') ||
    value.endsWith('.json') ||
    value.startsWith('.') ||
    value.startsWith('~')
  );
}

function listFontFiles(fontsDir) {
  if (!fs.existsSync(fontsDir) || !fs.statSync(fontsDir).isDirectory()) return [];
  return fs
    .readdirSync(fontsDir)
    .filter((f) => /\.(woff2?|ttf|otf|css)$/i.test(f))
    .map((f) => path.join(fontsDir, f));
}

/**
 * Load all themes from a themesDir.
 * Convention:
 *   themes/
 *     acme.json
 *     acme/fonts/*.woff2   (optional sibling folder)
 * @param {string} themesDirAbs
 * @param {{ publicBase?: string }} [options]
 * @returns {{ byName: Record<string, object>, pathThemes: Record<string, object> }}
 */
export function loadThemesFromDir(themesDirAbs, options = {}) {
  const publicBase = options.publicBase || '/themes';
  const byName = {};
  const pathThemes = {};
  const builtins = loadBuiltinThemes();

  if (!fs.existsSync(themesDirAbs)) {
    throw new Error(`themesDir not found: ${themesDirAbs}`);
  }

  const files = fs.readdirSync(themesDirAbs).filter((f) => f.endsWith('.json'));
  for (const fileName of files) {
    const filePath = path.join(themesDirAbs, fileName);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const validated = validateThemeJson(raw, { source: filePath });
    const id = path.basename(fileName, '.json');
    const name = validated.name || id;

    const siblingFontsDir = path.join(themesDirAbs, id, 'fonts');
    const discovered = listFontFiles(siblingFontsDir);
    let fontFiles = validated.fontFiles || validated.fonts?.files || [];

    // Resolve relative font paths against themesDir
    fontFiles = fontFiles.map((f) => {
      if (/^https?:\/\//i.test(f) || f.startsWith('/')) return f;
      const abs = path.resolve(themesDirAbs, f);
      // Rewrite to public URL served by Vite plugin / copied on build
      const rel = path.relative(themesDirAbs, abs).split(path.sep).join('/');
      return `${publicBase}/${rel}`;
    });

    if (discovered.length && fontFiles.length === 0) {
      fontFiles = discovered.map((abs) => {
        const rel = path.relative(themesDirAbs, abs).split(path.sep).join('/');
        return `${publicBase}/${rel}`;
      });
    }

    const normalized = normalizeTheme(
      {
        ...validated,
        name,
        ...(fontFiles.length
          ? {
              fontFiles,
              fonts: {
                ...(validated.fonts || {}),
                files: fontFiles,
              },
            }
          : {}),
      },
      { name, base: builtins.default },
    );

    byName[normalized.name] = normalized;
    pathThemes[filePath] = normalized;
    pathThemes[path.relative(process.cwd(), filePath)] = normalized;
    pathThemes[`./${path.relative(process.cwd(), filePath).split(path.sep).join('/')}`] =
      normalized;
    pathThemes[`${publicBase}/${id}`] = normalized;
    pathThemes[`./${id}`] = normalized;
    pathThemes[id] = normalized;
  }

  return { byName, pathThemes };
}

/**
 * Collect path-like refs from theme / themes config.
 * @param {object} config
 * @returns {string[]}
 */
function collectPathRefs(config) {
  const refs = [];
  const add = (ref) => {
    if (typeof ref === 'string' && isPathRef(ref)) refs.push(ref);
  };
  if (config.theme != null) add(config.theme);
  if (Array.isArray(config.themes)) {
    config.themes.forEach(add);
  } else if (config.themes && typeof config.themes === 'object') {
    Object.values(config.themes).forEach(add);
  }
  return refs;
}

/**
 * Resolve a single path ref to an absolute theme JSON path.
 * @param {string} ref
 * @param {string} configDir
 * @param {string} projectRoot
 */
function resolveThemePath(ref, configDir, projectRoot) {
  const candidates = [
    path.resolve(configDir, ref),
    path.resolve(projectRoot, ref),
    path.resolve(process.cwd(), ref),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      const jsonPath = path.join(candidate, `${path.basename(candidate)}.json`);
      if (fs.existsSync(jsonPath)) return jsonPath;
      const indexJson = path.join(candidate, 'theme.json');
      if (fs.existsSync(indexJson)) return indexJson;
    }
    const withJson = candidate.endsWith('.json') ? candidate : `${candidate}.json`;
    if (fs.existsSync(withJson)) return withJson;
  }
  throw new Error(`Theme path not found: ${ref}`);
}

/**
 * Load individual path refs into pathThemes map.
 * @param {string[]} refs
 * @param {string} configDir
 * @param {string} projectRoot
 */
function loadPathRefs(refs, configDir, projectRoot) {
  const pathThemes = {};
  const builtins = loadBuiltinThemes();
  for (const ref of refs) {
    const abs = resolveThemePath(ref, configDir, projectRoot);
    const themesDir = path.dirname(abs);
    const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const validated = validateThemeJson(raw, { source: abs });
    const id = path.basename(abs, '.json');
    const name = validated.name || id;

    const siblingFontsDir = path.join(themesDir, id, 'fonts');
    const altFontsDir = path.join(themesDir, 'fonts');
    const discovered = [...listFontFiles(siblingFontsDir), ...listFontFiles(altFontsDir)];
    let fontFiles = validated.fontFiles || validated.fonts?.files || [];
    fontFiles = fontFiles.map((f) => {
      if (/^https?:\/\//i.test(f) || f.startsWith('/')) return f;
      return `/themes/${path.basename(themesDir)}/${f.replace(/^\.\//, '')}`;
    });
    if (discovered.length && fontFiles.length === 0) {
      fontFiles = discovered.map((absFont) => `/themes/${id}/fonts/${path.basename(absFont)}`);
    }

    const normalized = normalizeTheme(
      {
        ...validated,
        name,
        ...(fontFiles.length ? { fontFiles } : {}),
      },
      { name, base: builtins.default },
    );
    pathThemes[ref] = normalized;
    pathThemes[abs] = normalized;
  }
  return pathThemes;
}

function resolveStringRef(ref, builtins, themesFromDir, pathThemes, mapKey) {
  if (pathThemes[ref]) {
    const loaded = pathThemes[ref];
    return mapKey && loaded.name !== mapKey ? { ...loaded, name: mapKey } : loaded;
  }
  if (isPathRef(ref)) {
    throw new Error(`Theme path "${ref}" was not loaded.`);
  }
  if (themesFromDir[ref]) {
    const loaded = themesFromDir[ref];
    return mapKey && loaded.name !== mapKey ? { ...loaded, name: mapKey } : loaded;
  }
  if (builtins[ref]) {
    const loaded = builtins[ref];
    return mapKey && loaded.name !== mapKey ? { ...loaded, name: mapKey } : loaded;
  }
  throw new Error(
    `Unknown theme "${ref}". Use a built-in name, a theme object, or a themesDir entry.`,
  );
}

function resolveRef(ref, builtins, themesFromDir, pathThemes, mapKey) {
  if (typeof ref === 'string') {
    return resolveStringRef(ref, builtins, themesFromDir, pathThemes, mapKey);
  }
  return normalizeTheme(ref, { name: mapKey, base: builtins.default });
}

/**
 * Resolve flexible theme fields on a loaded config into runtime themes[] + defaultTheme.
 * Mutates and returns the config.
 *
 * @param {object} config
 * @param {{ configDir: string, projectRoot: string }} ctx
 * @returns {object}
 */
export function resolveConfigThemes(config, ctx) {
  if (!config || typeof config !== 'object') return config;

  const hasThemeConfig =
    config.theme != null ||
    config.themes != null ||
    config.themesDir != null ||
    config.activeTheme != null ||
    config.defaultTheme != null;

  if (!hasThemeConfig && !config.themes) {
    // No theme config — runtime falls back to the built-in default theme.
    return config;
  }

  // Legacy: themes is already ThemeDefinition[] with no theme/themesDir — still normalize
  const builtins = loadBuiltinThemes();
  let themesFromDir = {};
  let pathThemes = {};

  if (config.themesDir) {
    const themesDirAbs = path.resolve(ctx.configDir, config.themesDir);
    const loaded = loadThemesFromDir(themesDirAbs, {
      publicBase: '/themes',
    });
    themesFromDir = loaded.byName;
    pathThemes = { ...pathThemes, ...loaded.pathThemes };
    // Stash abs path for Vite static serving
    config.__themesDirAbs = themesDirAbs;
  }

  const pathRefs = collectPathRefs(config);
  if (pathRefs.length) {
    pathThemes = { ...pathThemes, ...loadPathRefs(pathRefs, ctx.configDir, ctx.projectRoot) };
  }

  // Already-resolved ThemeDefinition[] only (legacy) and no new fields
  if (
    Array.isArray(config.themes) &&
    config.themes.length > 0 &&
    config.themes.every(
      (t) =>
        t &&
        typeof t === 'object' &&
        typeof t.name === 'string' &&
        t.colors &&
        isCompleteMode(t.colors.light) &&
        isCompleteMode(t.colors.dark),
    ) &&
    config.theme == null &&
    config.themesDir == null &&
    typeof config.themes[0] !== 'string'
  ) {
    config.themes = config.themes.map((t) => normalizeTheme(t));
    const active = config.activeTheme || config.defaultTheme || config.themes[0]?.name || 'default';
    config.activeTheme = active;
    config.defaultTheme = active;
    return config;
  }

  const resolved = [];
  const seen = new Set();
  const add = (theme) => {
    if (seen.has(theme.name)) {
      const idx = resolved.findIndex((t) => t.name === theme.name);
      if (idx >= 0) resolved[idx] = theme;
      return;
    }
    seen.add(theme.name);
    resolved.push(theme);
  };

  if (config.themes != null) {
    if (Array.isArray(config.themes)) {
      for (const ref of config.themes) {
        add(resolveRef(ref, builtins, themesFromDir, pathThemes));
      }
    } else if (typeof config.themes === 'object') {
      for (const [key, ref] of Object.entries(config.themes)) {
        add(resolveRef(ref, builtins, themesFromDir, pathThemes, key));
      }
    }
  } else if (config.theme != null) {
    add(resolveRef(config.theme, builtins, themesFromDir, pathThemes));
  } else if (Object.keys(themesFromDir).length > 0) {
    for (const theme of Object.values(themesFromDir)) add(theme);
  } else if (config.activeTheme || config.defaultTheme) {
    const name = config.activeTheme || config.defaultTheme;
    add(resolveStringRef(name, builtins, themesFromDir, pathThemes));
  } else {
    add(builtins.shellui || builtins.default);
  }

  let activeTheme =
    (typeof config.activeTheme === 'string' && config.activeTheme.trim()) ||
    (typeof config.defaultTheme === 'string' && config.defaultTheme.trim()) ||
    (typeof config.theme === 'string' && !isPathRef(config.theme) ? config.theme.trim() : '') ||
    (typeof config.theme === 'object' && config.theme?.name) ||
    resolved[0]?.name ||
    'shellui';

  if (activeTheme === 'default') activeTheme = 'shellui';

  if (!resolved.some((t) => t.name === activeTheme)) {
    try {
      add(resolveStringRef(activeTheme, builtins, themesFromDir, pathThemes));
    } catch {
      activeTheme = resolved[0]?.name || 'default';
      if (!resolved.length) {
        add(builtins.default);
        activeTheme = 'default';
      }
    }
  }

  config.themes = resolved;
  config.defaultTheme = activeTheme;
  config.activeTheme = activeTheme;
  delete config.theme;
  // Keep themesDir abs for vite; strip string path from frontend in prepareFrontendConfig
  return config;
}

/**
 * Collect watchable theme file paths for HMR.
 * @param {object} config
 * @param {{ configDir: string, projectRoot: string }} ctx
 * @returns {string[]}
 */
export function getWatchableThemePaths(config, ctx) {
  const paths = [];
  if (config?.themesDir) {
    const abs = path.resolve(ctx.configDir, config.themesDir);
    if (fs.existsSync(abs)) {
      paths.push(abs);
      for (const f of fs.readdirSync(abs)) {
        if (f.endsWith('.json')) paths.push(path.join(abs, f));
      }
    }
  }
  if (config?.__themesDirAbs && fs.existsSync(config.__themesDirAbs)) {
    paths.push(config.__themesDirAbs);
  }
  return paths;
}

/**
 * Reset caches (tests).
 */
export function resetThemeCaches() {
  cachedThemeValidate = null;
  cachedBuiltins = null;
}

export { pc };
