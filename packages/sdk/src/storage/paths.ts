/** Strip leading/trailing slashes from an object or folder path. */
export function normalizeStoragePath(path: string | undefined | null): string {
  if (!path) return '';
  return path.replace(/^\/+|\/+$/g, '');
}
