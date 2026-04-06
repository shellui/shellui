/**
 * Client hints for shellui-auth login audit (`/auth/v1/authorize` query params).
 * Must stay aligned with shellui-auth `normalize_client_timezone` / device id limits.
 */

const DEVICE_ID_STORAGE_KEY = 'shellui_auth_client_device_id';

const IANA_TZ_RE = /^[A-Za-z0-9_+/\-]{1,64}$/;

/**
 * IANA timezone from the browser (coarse hint only), or '' when unavailable/invalid.
 */
export function getShellUILoginClientTimezone(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || typeof tz !== 'string') {
      return '';
    }
    const s = tz.trim();
    if (!s || s.length > 64 || !IANA_TZ_RE.test(s)) {
      return '';
    }
    return s;
  } catch {
    return '';
  }
}

function newDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
}

/**
 * Stable first-party id (UUID) in localStorage, max 128 chars, or '' when unavailable.
 */
export function getShellUILoginDeviceId(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      const trimmed = existing.trim();
      if (trimmed && trimmed.length <= 128) {
        return trimmed;
      }
    }
    let created = newDeviceId();
    if (created.length > 128) {
      created = created.slice(0, 128);
    }
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return '';
  }
}
