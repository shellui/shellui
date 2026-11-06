/**
 * SaaS host HTTP paths (human session, Bearer JWT from shellui login).
 * Base URL is `saas.url` or `SHELLUI_SAAS_URL` (for example http://localhost:8005).
 */

/** Dashboard app mount: list/create companies, detail/patch by UUID */
export const SAAS_DASHBOARD_PREFIX = 'saas/api/v1';

/** Legacy / shared API v1 segments on the same host (regions, endpoints, …). */
export const SAAS_API_V1_PREFIX = 'api/v1';

/** @param {string} suffix path segment after .../saas/api/v1/ */
export function saasDashboardPath(suffix) {
  const s = suffix.startsWith('/') ? suffix.slice(1) : suffix;
  return `/${SAAS_DASHBOARD_PREFIX}/${s}`;
}

/** @param {string} suffix path segment after .../api/v1/ */
export function saasApiV1Path(suffix) {
  const s = suffix.startsWith('/') ? suffix.slice(1) : suffix;
  return `/${SAAS_API_V1_PREFIX}/${s}`;
}
