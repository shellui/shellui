/** Profile metadata persisted across reloads (no tokens). */
export const AUTH_PROFILE_STORAGE_KEY = 'shellui.auth.profile';

/** Tab-scoped refresh token when BFF is disabled (still JS-readable; prefer BFF). */
export const AUTH_REFRESH_STORAGE_KEY = 'shellui.auth.refresh';

/** Legacy monolithic session blob — migrated on read, then removed. */
export const LEGACY_AUTH_SESSION_STORAGE_KEY = 'shellui.auth.session';
