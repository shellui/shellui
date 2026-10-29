import fs from 'node:fs';
import { discoverConfigMode } from '../utils/config-paths.js';

/**
 * Write `hosting.slug` into the project's shellui.config.json after a new preview deploy.
 * Keeps key order, indent and trailing newline. Only main JSON configs are edited.
 * @param {string} configDir
 * @param {string} slug
 * @returns {{ saved: boolean, path?: string, reason?: string }}
 */
export function saveHostingSlug(configDir, slug) {
  let discovery;
  try {
    discovery = discoverConfigMode(configDir);
  } catch {
    return { saved: false, reason: 'config not readable' };
  }
  if (discovery.mode !== 'main' || !discovery.mainPath) {
    return { saved: false, reason: 'only shellui.config.json is updated automatically' };
  }
  const filePath = discovery.mainPath;
  const text = fs.readFileSync(filePath, 'utf8');
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    return { saved: false, reason: 'config is not valid JSON' };
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { saved: false, reason: 'config is not a JSON object' };
  }
  const hosting = config.hosting && typeof config.hosting === 'object' ? config.hosting : null;
  if (!hosting) return { saved: false, reason: 'no hosting block in config' };
  if (typeof hosting.slug === 'string' && hosting.slug.trim()) {
    return { saved: false, reason: 'hosting.slug is already set' };
  }
  hosting.slug = slug;
  const indentMatch = /\n([ \t]+)"/.exec(text);
  const indent = indentMatch ? indentMatch[1] : 2;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  let out = JSON.stringify(config, null, indent);
  if (eol !== '\n') out = out.replace(/\n/g, eol);
  if (/\r?\n$/.test(text)) out += eol;
  fs.writeFileSync(filePath, out, 'utf8');
  return { saved: true, path: filePath };
}
