import type { ChromeActionsPayload } from '@shellui/sdk';

/**
 * Synthetic frame id for `shellui.actions.*` calls from the shell window itself
 * (Settings → Develop test buttons). Not a real iframe.
 */
export const SHELL_DEVELOP_CHROME_ACTIONS_FRAME = '__shell_develop__';

export type FrameChromeActions = ChromeActionsPayload & {
  /** Frame UUID that owns this set (from message `from[0]`). */
  frameUuid: string;
};

type Listener = () => void;

const actionsByFrame = new Map<string, FrameChromeActions>();
const listeners = new Set<Listener>();
/** Stable snapshot for useSyncExternalStore — must keep referential identity until emit. */
let cachedSnapshot: FrameChromeActions[] = [];

function rebuildSnapshot(): void {
  cachedSnapshot = Array.from(actionsByFrame.values());
}

function emit(): void {
  rebuildSnapshot();
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Ignore subscriber errors.
    }
  }
}

export function getChromeActionsForFrame(frameUuid: string): FrameChromeActions | null {
  return actionsByFrame.get(frameUuid) ?? null;
}

export function getAllChromeActions(): FrameChromeActions[] {
  return cachedSnapshot;
}

export function setChromeActionsForFrame(frameUuid: string, payload: ChromeActionsPayload): void {
  if (!frameUuid) return;
  const hasAny =
    Boolean(payload.back) ||
    Boolean(payload.title) ||
    Boolean(payload.trailing?.length) ||
    Boolean(payload.primary);
  if (!hasAny) {
    if (actionsByFrame.delete(frameUuid)) emit();
    return;
  }
  actionsByFrame.set(frameUuid, { frameUuid, ...payload });
  emit();
}

export function clearChromeActionsForFrame(frameUuid: string): boolean {
  if (!frameUuid) return false;
  const removed = actionsByFrame.delete(frameUuid);
  if (removed) emit();
  return removed;
}

export function clearAllChromeActions(): void {
  if (actionsByFrame.size === 0) return;
  actionsByFrame.clear();
  emit();
}

export function subscribeChromeActions(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
