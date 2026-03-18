export const resolveLabel = (
  value: string | { en: string; fr: string; [key: string]: string },
  lang: string,
): string => {
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
};
