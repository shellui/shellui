import urls from '../../../constants/urls';

const SHELL_OWNED_PREFIXES = [
  urls.settings,
  urls.cookiePreferences,
  urls.overlayDemo,
  urls.login,
  urls.admin,
  urls.legalDocuments,
] as const;

/** True for shell React pages (settings, login, admin, …) — not embedded iframe apps. */
export function isShellOwnedPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return SHELL_OWNED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
