import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import {
  clampChromeActions,
  getLogger,
  shellui,
  type ChromeActionsPayload,
  type ShellUIMessage,
} from '@shellui/sdk';
import { republishLayoutChromeWithActions } from '../layouts/floating/layoutChromeStore';
import {
  clearChromeActionsForFrame,
  getAllChromeActions,
  setChromeActionsForFrame,
  subscribeChromeActions,
  SHELL_DEVELOP_CHROME_ACTIONS_FRAME,
} from './chromeActionsStore';

const logger = getLogger('shellcore');

function resolveFrameUuid(data: ShellUIMessage, event: MessageEvent): string | null {
  const fromUuid = data.from?.[0];
  if (fromUuid) return fromUuid;
  const source = event.source;
  // Use `typeof window` (lowercase) for SSR — `Window` is a TS type / ambient interface.
  if (source && typeof window !== 'undefined' && source instanceof Window) {
    const bySource = shellui.getUuidByIframe(source);
    if (bySource) return bySource;
  }
  // Same-window posts (Settings → Develop) — no iframe uuid.
  if (source === window || source === null) {
    return SHELL_DEVELOP_CHROME_ACTIONS_FRAME;
  }
  return null;
}

/**
 * Resolve the frame UUID for a `removeIframe` argument before the registry drops it.
 * When the iframe is already detached, `contentWindow` is null — fall back to matching
 * the element in `frameRegistry`.
 */
export function resolveUuidFromRemoveTarget(
  identifier: string | { contentWindow: Window | null },
  lookup: {
    getUuidByWindow: (win: Window) => string | undefined;
    findUuidByElement: (el: unknown) => string | undefined;
  },
): string | undefined {
  if (typeof identifier === 'string') return identifier;
  const win = identifier.contentWindow;
  if (win) {
    const byWindow = lookup.getUuidByWindow(win);
    if (byWindow) return byWindow;
  }
  return lookup.findUuidByElement(identifier);
}

export function resolveUuidForRemoveIframe(
  identifier: string | HTMLIFrameElement,
): string | undefined {
  return resolveUuidFromRemoveTarget(identifier, {
    getUuidByWindow: (win) => shellui.getUuidByIframe(win),
    findUuidByElement: (el) => {
      for (const [uuid, iframe] of shellui.frameRegistry.getAllIframes()) {
        if (iframe === el) return uuid;
      }
      return undefined;
    },
  });
}

/**
 * Listens for SHELLUI_ACTIONS_SET / CLEAR and keeps the per-frame store in sync.
 * Also clears actions when a content iframe is removed (shell navigation).
 */
export function ChromeActionsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onSet = (data: ShellUIMessage, event: MessageEvent) => {
      const frameUuid = resolveFrameUuid(data, event);
      if (!frameUuid) {
        logger.warn('SHELLUI_ACTIONS_SET without frame uuid — ignored');
        return;
      }
      const raw = (data.payload ?? {}) as ChromeActionsPayload;
      const { payload, warnings } = clampChromeActions({
        back: raw.back,
        title: raw.title,
        trailing: raw.trailing,
        primary: raw.primary,
      });
      for (const warning of warnings) {
        logger.warn(warning);
      }
      setChromeActionsForFrame(frameUuid, payload);
      republishLayoutChromeWithActions();
    };

    const onClear = (data: ShellUIMessage, event: MessageEvent) => {
      const frameUuid = resolveFrameUuid(data, event);
      if (!frameUuid) return;
      clearChromeActionsForFrame(frameUuid);
      republishLayoutChromeWithActions();
    };

    const stopSet = shellui.addMessageListener('SHELLUI_ACTIONS_SET', onSet);
    const stopClear = shellui.addMessageListener('SHELLUI_ACTIONS_CLEAR', onClear);
    return () => {
      stopSet();
      stopClear();
    };
  }, []);

  // Wrap removeIframe so shell nav / remount clears that view's actions + padding.
  useEffect(() => {
    const original = shellui.removeIframe.bind(shellui);
    shellui.removeIframe = ((identifier: string | HTMLIFrameElement) => {
      // Resolve UUID before the registry forgets the iframe (contentWindow may already be null).
      const uuid = resolveUuidForRemoveIframe(identifier);
      const result = original(identifier);
      if (uuid) {
        clearChromeActionsForFrame(uuid);
        republishLayoutChromeWithActions();
      }
      return result;
    }) as typeof shellui.removeIframe;
    return () => {
      shellui.removeIframe = original;
    };
  }, []);

  return <>{children}</>;
}

export function useChromeActionsSnapshot() {
  return useSyncExternalStore(subscribeChromeActions, getAllChromeActions, getAllChromeActions);
}

export function useChromeActionsForFrame(frameUuid: string | null | undefined) {
  const all = useChromeActionsSnapshot();
  if (!frameUuid) return null;
  return all.find((entry) => entry.frameUuid === frameUuid) ?? null;
}
