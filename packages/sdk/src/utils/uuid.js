/**
 * UUID Utility
 * Generates UUID v4 identifiers
 */

/**
 * Generates a UUID v4
 * Uses crypto.randomUUID() if available, otherwise falls back to a manual implementation
 * @returns {string} A UUID v4 string
 */
export function generateUuid() {
  // Use crypto.randomUUID() if available (modern browsers and Node.js 14.17.0+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
