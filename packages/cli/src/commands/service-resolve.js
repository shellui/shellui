import { peekServiceUrlsFromConfig } from '../utils/peek-service-config.js';

const DEFAULT_SAAS_DEV = 'http://localhost:8005';

/**
 * @param {{ root?: string, config?: string }} options
 * @returns {string}
 */
export function resolveSaasBaseUrl(options = {}) {
  const peeked = peekServiceUrlsFromConfig(options.root ?? '.', { config: options.config });
  const fromConfig = typeof peeked?.saas?.url === 'string' && peeked.saas.url.trim();
  if (fromConfig) return peeked.saas.url.replace(/\/$/, '');
  const env = process.env.SHELLUI_SAAS_URL;
  if (typeof env === 'string' && env.trim()) return env.replace(/\/$/, '');
  return DEFAULT_SAAS_DEV.replace(/\/$/, '');
}

/**
 * @param {{ root?: string, config?: string }} options
 * @returns {string | null}
 */
export function resolveStorageBaseUrl(options = {}) {
  const peeked = peekServiceUrlsFromConfig(options.root ?? '.', { config: options.config });
  const url =
    typeof peeked?.storage?.url === 'string' && peeked.storage.url.trim()
      ? peeked.storage.url.trim()
      : '';
  return url ? url.replace(/\/$/, '') : null;
}

/**
 * @param {{ root?: string, config?: string }} options
 * @returns {string | null}
 */
export function resolveHostingBaseUrl(options = {}) {
  const peeked = peekServiceUrlsFromConfig(options.root ?? '.', { config: options.config });
  const url =
    typeof peeked?.hosting?.url === 'string' && peeked.hosting.url.trim()
      ? peeked.hosting.url.trim()
      : '';
  return url ? url.replace(/\/$/, '') : null;
}

/**
 * @param {{ root?: string, config?: string }} options
 * @returns {string | null}
 */
export function resolveHostingSlugFromConfig(options = {}) {
  const peeked = peekServiceUrlsFromConfig(options.root ?? '.', { config: options.config });
  const raw =
    typeof peeked?.hosting?.slug === 'string' && peeked.hosting.slug.trim()
      ? peeked.hosting.slug.trim()
      : '';
  return raw || null;
}
