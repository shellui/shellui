/**
 * Helpers for variadic nested CLI commands (cac matches only the first word).
 */

/**
 * @param {string} token
 * @returns {boolean}
 */
export function isLikelyProjectRootPath(token) {
  if (token == null || token === '') return false;
  if (token === '.') return true;
  if (token.startsWith('./') || token.startsWith('../')) return true;
  if (token.startsWith('/') || token.includes('/') || token.includes('\\')) return true;
  return false;
}

/**
 * Pops a trailing project root only when it looks like a path (not a slug or uuid).
 * @param {string[]} tokens
 */
export function popOptionalRoot(tokens) {
  if (tokens.length === 0) return { rest: [], root: '.' };
  const last = tokens[tokens.length - 1];
  if (typeof last === 'string' && isLikelyProjectRootPath(last)) {
    return { rest: tokens.slice(0, -1), root: last };
  }
  return { rest: [...tokens], root: '.' };
}

/**
 * @param {string} kind
 * @param {string} sub
 */
export function unknownNestedCommand(kind, sub) {
  const s = sub == null || sub === '' ? '(none)' : sub;
  return `Unknown ${kind} subcommand or missing args: ${s}. Pass --help for usage.`;
}
