import path from 'path';
import fs from 'fs';

const GITIGNORE_DIST_ENTRY = 'dist/\n';

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🐚</text></svg>`;
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50"><text y="35" font-size="30" fill="currentColor">My App</text></svg>`;

/**
 * Ensure dist/ is listed in .gitignore (web and desktop build output).
 * @param {string} projectDir
 */
export function ensureDistGitignore(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (content.split('\n').some((line) => line.trim() === 'dist/' || line.trim() === 'dist')) {
      return;
    }
    fs.appendFileSync(gitignorePath, (content.endsWith('\n') ? '' : '\n') + GITIGNORE_DIST_ENTRY);
    return;
  }
  fs.writeFileSync(gitignorePath, GITIGNORE_DIST_ENTRY, 'utf-8');
}

/**
 * Create empty shell scaffold with minimal static files.
 * @param {string} projectRoot
 * @returns {{ created: boolean }}
 */
export function createEmptyShell(projectRoot) {
  const staticDir = path.join(projectRoot, 'static');
  if (fs.existsSync(staticDir)) {
    return { created: false };
  }
  fs.mkdirSync(staticDir, { recursive: true });
  fs.writeFileSync(path.join(staticDir, 'favicon.svg'), FAVICON_SVG, 'utf-8');
  fs.writeFileSync(path.join(staticDir, 'logo.svg'), LOGO_SVG, 'utf-8');
  return { created: true };
}
