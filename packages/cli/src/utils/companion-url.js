import { URL } from 'url';

/** @typedef {{ ok: true, url: string, warnings: string[] } | { ok: false, error: string, warnings: string[] }} CompanionUrlValidation */

/**
 * Hostnames that must never be probed as companion URLs (SSRF-style residual).
 * @param {string} hostname
 */
export function isBlockedCompanionHost(hostname) {
  const host = String(hostname)
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (host === '169.254.169.254') return true;
  if (host.endsWith('.metadata.google.internal')) return true;
  if (host === 'metadata.google.internal') return true;
  if (host.startsWith('fe80:') || host.startsWith('fe80::')) return true;
  return false;
}

/**
 * @param {string} hostname
 */
export function isLoopbackHost(hostname) {
  const host = String(hostname)
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

/**
 * Parse companion URL or host:port shorthand.
 * @param {string} raw
 * @returns {URL | null}
 */
export function parseCompanionUrl(raw) {
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  try {
    if (!trimmed.includes('://')) {
      const match = /^(?:\[([^\]]+)\]|([^:]+)):(\d+)$/.exec(trimmed);
      if (!match) return null;
      const host = match[1] || match[2];
      return new URL(`http://${host}:${match[3]}/`);
    }
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/**
 * Validate companion / `--follow` URLs before probing.
 *
 * Default policy: loopback http(s) only. Non-loopback URLs warn unless
 * `allowRemote` is set; cloud metadata / link-local hosts are always rejected.
 *
 * @param {string} raw
 * @param {{ allowRemote?: boolean, source?: string }} [options]
 * @returns {CompanionUrlValidation}
 */
export function validateCompanionUrl(raw, { allowRemote = false, source = 'dev.url' } = {}) {
  const warnings = [];
  const parsed = parseCompanionUrl(raw);
  if (!parsed) {
    return { ok: false, error: `Invalid companion URL (${source}): ${raw}`, warnings };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      error: `Companion URL must use http or https (${source}): ${raw}`,
      warnings,
    };
  }

  const hostname = parsed.hostname;
  if (isBlockedCompanionHost(hostname)) {
    return {
      ok: false,
      error: `Refusing risky companion URL (${source}): ${raw}. Cloud metadata and link-local hosts are not allowed.`,
      warnings,
    };
  }

  const loopback = isLoopbackHost(hostname);
  if (!loopback && !allowRemote) {
    warnings.push(
      `Companion URL ${parsed.href} is not loopback (${source}). ` +
        'The CLI will probe this address from your machine. Use localhost/127.0.0.1 in dev, ' +
        'or pass --allow-remote-companion if you intentionally follow a remote URL.',
    );
  }

  const normalized = parsed.href.endsWith('/') ? parsed.href.slice(0, -1) : parsed.href;
  return { ok: true, url: normalized, warnings };
}
