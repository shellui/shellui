import type { Settings } from '@shellui/sdk';

const groupsFingerprint = (g: Settings['user']): string =>
  [...(g?.groups ?? [])].sort().join('\0');

export const isSameUser = (a: Settings['user'], b: Settings['user']) => {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    a.id === b.id &&
    a.email === b.email &&
    a.name === b.name &&
    a.profilePicture === b.profilePicture &&
    a.authProvider === b.authProvider &&
    groupsFingerprint(a) === groupsFingerprint(b)
  );
};
