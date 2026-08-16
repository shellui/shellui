export class AuthRequestError extends Error {
  readonly code: string | null;

  constructor(message: string, code?: string | null) {
    super(message);
    this.name = 'AuthRequestError';
    this.code = typeof code === 'string' && code.trim() ? code.trim() : null;
  }
}

/** Company join blocked until an admin enables the account (or domain mismatch). */
export function isAccessPendingErrorCode(code: string | null | undefined): boolean {
  return code === 'access_pending' || code === 'access_denied';
}

/** Duck-type safe: `instanceof` can fail across duplicated bundles. */
export function getAuthRequestErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  if (err instanceof AuthRequestError) return err.code;
  const maybe = err as { name?: unknown; code?: unknown };
  if (maybe.name === 'AuthRequestError' && typeof maybe.code === 'string' && maybe.code.trim()) {
    return maybe.code.trim();
  }
  if (typeof maybe.code === 'string' && maybe.code.trim()) {
    return maybe.code.trim();
  }
  return null;
}

/** Infer pending/denied from known backend messages when error_code is missing. */
export function inferAccessPendingErrorCode(
  message: string | null | undefined,
): 'access_pending' | 'access_denied' | null {
  const text = (message || '').toLowerCase();
  if (!text) return null;
  if (text.includes('email domain is not authorized')) return 'access_denied';
  if (
    text.includes('waiting for an administrator') ||
    text.includes('company access is disabled') ||
    text.includes('grant access')
  ) {
    return 'access_pending';
  }
  return null;
}
