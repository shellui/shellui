// Ensures auth redirect paths are absolute and start with a slash.
export const normalizeRedirectPath = (redirectPath: string) =>
  redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
