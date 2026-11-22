/**
 * SHELLUI_SETTINGS and SHELLUI_SETTINGS_UPDATED carry shell settings and may
 * include an access token. Apply them only from window.parent, and only when
 * that parent's origin is known and matches event.origin.
 * "null", "*", and an unresolved parent are not verified origins.
 */

const UNVERIFIED_ORIGINS = new Set(['null', '*', '']);

export function isConcreteOrigin(origin: string | null | undefined): origin is string {
  return typeof origin === 'string' && !UNVERIFIED_ORIGINS.has(origin);
}

export function shouldApplySettingsFromParent(input: {
  parentOrigin: string | null;
  sourceIsParent: boolean;
  eventOrigin: string;
}): boolean {
  if (!input.sourceIsParent) return false;
  if (!isConcreteOrigin(input.parentOrigin)) return false;
  return input.eventOrigin === input.parentOrigin;
}
