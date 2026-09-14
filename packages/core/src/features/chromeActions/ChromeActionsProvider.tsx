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
} from './chromeActionsStore';

const logger = getLogger('shellcore');

function resolveFrameUuid(data: ShellUIMessage, event: MessageEvent): string | null {
  const fromUuid = data.from?.[0];
  if (fromUuid) return fromUuid;
  const bySource = shellui.getUuidByIframe(event.source as Window);
  return bySource ?? null;
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
      let uuid: string | undefined;
      if (typeof identifier === 'string') {
        uuid = identifier;
      } else if (identifier instanceof HTMLIFrameElement) {
        uuid = shellui.getUuidByIframe(identifier.contentWindow);
      }
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
