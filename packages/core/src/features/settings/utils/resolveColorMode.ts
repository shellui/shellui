export const resolveColorMode = (colorScheme: 'light' | 'dark' | 'system'): 'light' | 'dark' => {
  if (colorScheme === 'system' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return colorScheme === 'dark' ? 'dark' : 'light';
};
