/**
 * UUID Utility
 * Generates UUID v4 identifiers
 */

/**
 * Generates a UUID v4
 * Uses crypto.randomUUID() if available, otherwise falls back to a manual implementation
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
