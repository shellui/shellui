#!/usr/bin/env node
/**
 * Generate packages/core/schemas/curated-themes.json from curated/*.json.
 * Run: pnpm --filter @shellui/core run generate:curated-themes
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const curatedDir = path.join(packageRoot, 'src/features/theme/curated');
const outPath = path.join(packageRoot, 'schemas', 'curated-themes.json');

const files = [
  'shellui.json',
  'claude.json',
  'light-green.json',
  'zen-inspired.json',
  'astro-vista.json',
  'shadcn.json',
  'amber-minimal.json',
  'amethyst-haze.json',
  'bold-tech.json',
  'bubblegum.json',
  'caffeine.json',
  'candyland.json',
  'catppuccin.json',
  'claymorphism.json',
  'clean-slate.json',
  'cosmic-night.json',
  'cyberpunk.json',
  'darkmatter.json',
  'doom-64.json',
  'elegant-luxury.json',
  'graphite.json',
  'kodama-grove.json',
  'midnight-bloom.json',
  'mocha-mousse.json',
  'modern-minimal.json',
  'mono.json',
  'nature.json',
  'neo-brutalism.json',
  'northern-lights.json',
  'notebook.json',
  'ocean-breeze.json',
  'pastel-dreams.json',
  'perpetuity.json',
  'quantum-rose.json',
  'retro-arcade.json',
  'sage-garden.json',
  'soft-pop.json',
  'solar-dusk.json',
  'starry-night.json',
  'sunset-horizon.json',
  'supabase.json',
  't3-chat.json',
  'tangerine.json',
  'twitter.json',
  'vercel.json',
  'vintage-paper.json',
  'violet-bloom.json',
];
const themes = files.map((fileName) => {
  const full = path.join(curatedDir, fileName);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
});

const payload = { version: 1, themes };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath} (${themes.length} themes)`);
