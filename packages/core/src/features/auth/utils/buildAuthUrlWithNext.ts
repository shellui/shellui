const shouldIncludeNextParam = (nextPath: string | null | undefined): nextPath is string =>
  Boolean(nextPath && nextPath !== '/');

export const buildAuthUrlWithNext = (
  basePath: string,
  nextPath: string | null | undefined,
): string => {
  if (!shouldIncludeNextParam(nextPath)) {
    return basePath;
  }
  return `${basePath}?next=${encodeURIComponent(nextPath)}`;
};
