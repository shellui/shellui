import {
  THEME_COLOR_KEYS,
  type ThemeColorsMode,
  type ThemeDefinition,
  type ThemeInput,
} from '../types';
import shelluiJson from './shellui.json';
import claudeJson from './claude.json';
import lightGreenJson from './light-green.json';
import zenInspiredJson from './zen-inspired.json';
import astroVistaJson from './astro-vista.json';
import shadcnJson from './shadcn.json';
import amberMinimalJson from './amber-minimal.json';
import amethystHazeJson from './amethyst-haze.json';
import boldTechJson from './bold-tech.json';
import bubblegumJson from './bubblegum.json';
import caffeineJson from './caffeine.json';
import candylandJson from './candyland.json';
import catppuccinJson from './catppuccin.json';
import claymorphismJson from './claymorphism.json';
import cleanSlateJson from './clean-slate.json';
import cosmicNightJson from './cosmic-night.json';
import cyberpunkJson from './cyberpunk.json';
import darkmatterJson from './darkmatter.json';
import doom64Json from './doom-64.json';
import elegantLuxuryJson from './elegant-luxury.json';
import graphiteJson from './graphite.json';
import kodamaGroveJson from './kodama-grove.json';
import midnightBloomJson from './midnight-bloom.json';
import mochaMousseJson from './mocha-mousse.json';
import modernMinimalJson from './modern-minimal.json';
import monoJson from './mono.json';
import natureJson from './nature.json';
import neoBrutalismJson from './neo-brutalism.json';
import northernLightsJson from './northern-lights.json';
import notebookJson from './notebook.json';
import oceanBreezeJson from './ocean-breeze.json';
import pastelDreamsJson from './pastel-dreams.json';
import perpetuityJson from './perpetuity.json';
import quantumRoseJson from './quantum-rose.json';
import retroArcadeJson from './retro-arcade.json';
import sageGardenJson from './sage-garden.json';
import softPopJson from './soft-pop.json';
import solarDuskJson from './solar-dusk.json';
import starryNightJson from './starry-night.json';
import sunsetHorizonJson from './sunset-horizon.json';
import supabaseJson from './supabase.json';
import t3ChatJson from './t3-chat.json';
import tangerineJson from './tangerine.json';
import twitterJson from './twitter.json';
import vercelJson from './vercel.json';
import vintagePaperJson from './vintage-paper.json';
import violetBloomJson from './violet-bloom.json';

function assertCompleteMode(mode: Record<string, string>, themeName: string): ThemeColorsMode {
  for (const key of THEME_COLOR_KEYS) {
    if (typeof mode[key] !== 'string' || !mode[key]) {
      throw new Error(`Curated theme "${themeName}" is missing color token "${key}"`);
    }
  }
  return mode as ThemeColorsMode;
}

/**
 * Load a complete curated theme JSON into a ThemeDefinition (no merge / no normalize import).
 */
export function themeFromCuratedJson(input: ThemeInput): ThemeDefinition {
  const name = input.name;
  if (!name) throw new Error('Curated theme JSON requires name');
  const light = assertCompleteMode({ ...(input.light as Record<string, string>) }, name);
  const dark = assertCompleteMode({ ...(input.dark as Record<string, string>) }, name);
  const fonts = input.fonts;
  const bodyFontFamily = input.bodyFontFamily || fonts?.body || fonts?.sans || input.fontFamily;
  const headingFontFamily =
    input.headingFontFamily || fonts?.heading || fonts?.sans || input.fontFamily;
  const fontFamily = input.fontFamily || fonts?.sans || bodyFontFamily;
  const fontFiles = input.fontFiles ?? fonts?.files;

  return {
    name,
    displayName: input.label || input.displayName || name,
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

export const shelluiTheme = themeFromCuratedJson(shelluiJson as ThemeInput);
export const claudeTheme = themeFromCuratedJson(claudeJson as ThemeInput);
export const lightGreenTheme = themeFromCuratedJson(lightGreenJson as ThemeInput);
export const zenInspiredTheme = themeFromCuratedJson(zenInspiredJson as ThemeInput);
export const astroVistaTheme = themeFromCuratedJson(astroVistaJson as ThemeInput);
export const shadcnTheme = themeFromCuratedJson(shadcnJson as ThemeInput);
export const amberMinimalTheme = themeFromCuratedJson(amberMinimalJson as ThemeInput);
export const amethystHazeTheme = themeFromCuratedJson(amethystHazeJson as ThemeInput);
export const boldTechTheme = themeFromCuratedJson(boldTechJson as ThemeInput);
export const bubblegumTheme = themeFromCuratedJson(bubblegumJson as ThemeInput);
export const caffeineTheme = themeFromCuratedJson(caffeineJson as ThemeInput);
export const candylandTheme = themeFromCuratedJson(candylandJson as ThemeInput);
export const catppuccinTheme = themeFromCuratedJson(catppuccinJson as ThemeInput);
export const claymorphismTheme = themeFromCuratedJson(claymorphismJson as ThemeInput);
export const cleanSlateTheme = themeFromCuratedJson(cleanSlateJson as ThemeInput);
export const cosmicNightTheme = themeFromCuratedJson(cosmicNightJson as ThemeInput);
export const cyberpunkTheme = themeFromCuratedJson(cyberpunkJson as ThemeInput);
export const darkmatterTheme = themeFromCuratedJson(darkmatterJson as ThemeInput);
export const doom64Theme = themeFromCuratedJson(doom64Json as ThemeInput);
export const elegantLuxuryTheme = themeFromCuratedJson(elegantLuxuryJson as ThemeInput);
export const graphiteTheme = themeFromCuratedJson(graphiteJson as ThemeInput);
export const kodamaGroveTheme = themeFromCuratedJson(kodamaGroveJson as ThemeInput);
export const midnightBloomTheme = themeFromCuratedJson(midnightBloomJson as ThemeInput);
export const mochaMousseTheme = themeFromCuratedJson(mochaMousseJson as ThemeInput);
export const modernMinimalTheme = themeFromCuratedJson(modernMinimalJson as ThemeInput);
export const monoTheme = themeFromCuratedJson(monoJson as ThemeInput);
export const natureTheme = themeFromCuratedJson(natureJson as ThemeInput);
export const neoBrutalismTheme = themeFromCuratedJson(neoBrutalismJson as ThemeInput);
export const northernLightsTheme = themeFromCuratedJson(northernLightsJson as ThemeInput);
export const notebookTheme = themeFromCuratedJson(notebookJson as ThemeInput);
export const oceanBreezeTheme = themeFromCuratedJson(oceanBreezeJson as ThemeInput);
export const pastelDreamsTheme = themeFromCuratedJson(pastelDreamsJson as ThemeInput);
export const perpetuityTheme = themeFromCuratedJson(perpetuityJson as ThemeInput);
export const quantumRoseTheme = themeFromCuratedJson(quantumRoseJson as ThemeInput);
export const retroArcadeTheme = themeFromCuratedJson(retroArcadeJson as ThemeInput);
export const sageGardenTheme = themeFromCuratedJson(sageGardenJson as ThemeInput);
export const softPopTheme = themeFromCuratedJson(softPopJson as ThemeInput);
export const solarDuskTheme = themeFromCuratedJson(solarDuskJson as ThemeInput);
export const starryNightTheme = themeFromCuratedJson(starryNightJson as ThemeInput);
export const sunsetHorizonTheme = themeFromCuratedJson(sunsetHorizonJson as ThemeInput);
export const supabaseTheme = themeFromCuratedJson(supabaseJson as ThemeInput);
export const t3ChatTheme = themeFromCuratedJson(t3ChatJson as ThemeInput);
export const tangerineTheme = themeFromCuratedJson(tangerineJson as ThemeInput);
export const twitterTheme = themeFromCuratedJson(twitterJson as ThemeInput);
export const vercelTheme = themeFromCuratedJson(vercelJson as ThemeInput);
export const vintagePaperTheme = themeFromCuratedJson(vintagePaperJson as ThemeInput);
export const violetBloomTheme = themeFromCuratedJson(violetBloomJson as ThemeInput);

/**
 * Official default theme (Shellui brand). Also available as `themes.default` for init BC.
 */
export const defaultTheme: ThemeDefinition = shelluiTheme;

const curatedList: ThemeDefinition[] = [
  shelluiTheme,
  claudeTheme,
  lightGreenTheme,
  zenInspiredTheme,
  astroVistaTheme,
  shadcnTheme,
  amberMinimalTheme,
  amethystHazeTheme,
  boldTechTheme,
  bubblegumTheme,
  caffeineTheme,
  candylandTheme,
  catppuccinTheme,
  claymorphismTheme,
  cleanSlateTheme,
  cosmicNightTheme,
  cyberpunkTheme,
  darkmatterTheme,
  doom64Theme,
  elegantLuxuryTheme,
  graphiteTheme,
  kodamaGroveTheme,
  midnightBloomTheme,
  mochaMousseTheme,
  modernMinimalTheme,
  monoTheme,
  natureTheme,
  neoBrutalismTheme,
  northernLightsTheme,
  notebookTheme,
  oceanBreezeTheme,
  pastelDreamsTheme,
  perpetuityTheme,
  quantumRoseTheme,
  retroArcadeTheme,
  sageGardenTheme,
  softPopTheme,
  solarDuskTheme,
  starryNightTheme,
  sunsetHorizonTheme,
  supabaseTheme,
  t3ChatTheme,
  tangerineTheme,
  twitterTheme,
  vercelTheme,
  vintagePaperTheme,
  violetBloomTheme,
];

/**
 * Curated themes keyed by name.
 * `default` aliases `shellui` so existing `theme: "default"` configs keep working.
 */
export const themes: Record<string, ThemeDefinition> = {
  shellui: shelluiTheme,
  default: shelluiTheme,
  claude: claudeTheme,
  'light-green': lightGreenTheme,
  'zen-inspired': zenInspiredTheme,
  'astro-vista': astroVistaTheme,
  shadcn: shadcnTheme,
  'amber-minimal': amberMinimalTheme,
  'amethyst-haze': amethystHazeTheme,
  'bold-tech': boldTechTheme,
  bubblegum: bubblegumTheme,
  caffeine: caffeineTheme,
  candyland: candylandTheme,
  catppuccin: catppuccinTheme,
  claymorphism: claymorphismTheme,
  'clean-slate': cleanSlateTheme,
  'cosmic-night': cosmicNightTheme,
  cyberpunk: cyberpunkTheme,
  darkmatter: darkmatterTheme,
  'doom-64': doom64Theme,
  'elegant-luxury': elegantLuxuryTheme,
  graphite: graphiteTheme,
  'kodama-grove': kodamaGroveTheme,
  'midnight-bloom': midnightBloomTheme,
  'mocha-mousse': mochaMousseTheme,
  'modern-minimal': modernMinimalTheme,
  mono: monoTheme,
  nature: natureTheme,
  'neo-brutalism': neoBrutalismTheme,
  'northern-lights': northernLightsTheme,
  notebook: notebookTheme,
  'ocean-breeze': oceanBreezeTheme,
  'pastel-dreams': pastelDreamsTheme,
  perpetuity: perpetuityTheme,
  'quantum-rose': quantumRoseTheme,
  'retro-arcade': retroArcadeTheme,
  'sage-garden': sageGardenTheme,
  'soft-pop': softPopTheme,
  'solar-dusk': solarDuskTheme,
  'starry-night': starryNightTheme,
  'sunset-horizon': sunsetHorizonTheme,
  supabase: supabaseTheme,
  't3-chat': t3ChatTheme,
  tangerine: tangerineTheme,
  twitter: twitterTheme,
  vercel: vercelTheme,
  'vintage-paper': vintagePaperTheme,
  'violet-bloom': violetBloomTheme,
};

/** Ordered curated theme names (excludes the `default` alias). */
export const themeNames: string[] = curatedList.map((theme) => theme.name);

export const recommendedThemeNames: string[] = curatedList
  .filter((theme) => theme.recommended)
  .map((theme) => theme.name);

export { curatedList as curatedThemes };
