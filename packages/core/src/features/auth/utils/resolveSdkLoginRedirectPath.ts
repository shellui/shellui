import urls from '../../../constants/urls';
import { buildAuthUrlWithNext } from './buildAuthUrlWithNext';
import { normalizeNextPath } from './normalizeNextPath';

const isCallbackPath = (value: string) =>
  value === urls.loginCallback || value.startsWith(`${urls.loginCallback}?`);

const pageAfterSignIn = (value: string | null | undefined): string | null => {
  const next = normalizeNextPath(value?.trim() || null);
  return next && !isCallbackPath(next) ? next : null;
};

/**
 * Pick the `redirect_to` path for a `SHELLUI_LOGIN` request from an app.
 *
 * Only the callback route exchanges the OAuth code, so the request always
 * returns there. `redirectPath` names the page to open after sign-in. With no
 * usable `redirectPath`, people come back to the page they started from.
 * An explicit callback path is kept as is.
 */
export const resolveSdkLoginRedirectPath = (
  redirectPath: string | null | undefined,
  currentPath: string,
): string => {
  const requested = redirectPath?.trim();
  if (requested && isCallbackPath(requested)) {
    return requested;
  }
  const next = pageAfterSignIn(requested) ?? pageAfterSignIn(currentPath);
  return buildAuthUrlWithNext(urls.loginCallback, next);
};
