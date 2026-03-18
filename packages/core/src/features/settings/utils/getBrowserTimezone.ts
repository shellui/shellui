// Get browser's timezone as default
export const getBrowserTimezone = (): string => {
  if (typeof window !== 'undefined' && Intl) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return 'UTC';
};
