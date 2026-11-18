/**
 * SaaS host HTTP paths (human session, Bearer JWT from shellui login).
 * Base URL is `saas.url` or `SHELLUI_SAAS_URL` (for example http://localhost:8005).
 *
 * Align with saas-service: dashboard companies and related routes share the `api/v1/`
 * mount (for example `companies/`, `companies/<uuid>/`, `regions/`, `companies/<uuid>/endpoints/`).
 * If `saas.url` includes a path prefix (for example `https://host/saas`), paths append after it
 * (for example `https://host/saas/api/v1/companies/`). There is no extra `saas/` segment in the path.
 */

/** Apps and directory API on the SaaS host */
export const SAAS_API_V1_PREFIX = 'api/v1';

/** @param {string} suffix path segment after .../api/v1/ */
export function saasApiV1Path(suffix) {
  const s = suffix.startsWith('/') ? suffix.slice(1) : suffix;
  return `/${SAAS_API_V1_PREFIX}/${s}`;
}
