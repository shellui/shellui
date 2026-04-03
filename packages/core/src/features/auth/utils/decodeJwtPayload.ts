// Decodes a JWT payload section into a plain object.
export const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** Normalizes `user_metadata.groups` from a ShellUI auth JWT to sorted unique names. */
export const normalizeJwtUserGroups = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const names = raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((n) => n.trim());
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
};
