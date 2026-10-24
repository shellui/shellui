/**
 * Host-side helper for an app that embeds another Shellui app.
 *
 * The embedding app (already inside the shell) registers the child frame. Its
 * SDK then relays the child's messages (settings requests, toasts, dialogs and
 * so on) to the shell and routes the shell replies back down, using the same
 * frame registry the shell uses. The shell answers the child with settings
 * built for the child's own backend, never with the host's token.
 */

import { getLogger } from '../logger/logger.js';
import type { FrameRegistry } from './frameRegistry.js';
import type { MessageSecurityPolicy } from './messageSecurity.js';
import type { ShellUIMessage, ShellUIUrlPayload } from '../types.js';

const logger = getLogger('shellsdk');

export const CHILD_FRAME_REGISTER = 'SHELLUI_CHILD_FRAME_REGISTER';
export const CHILD_FRAME_UNREGISTER = 'SHELLUI_CHILD_FRAME_UNREGISTER';
/** Shell to host: whether the child app got a session on its identity server. */
export const CHILD_FRAME_SESSION = 'SHELLUI_CHILD_FRAME_SESSION';

/** Session result for a child app. `reason` and `hint` never contain tokens. */
export type AppFrameSessionStatus = {
  ok: boolean;
  reason?: string;
  hint?: string;
};

/** Identity server the child app signs in to. The shell checks it against its config. */
export type AppFrameBackend = {
  url: string;
  companyId?: string | number;
  type?: 'shellui' | 'supabase';
  provider?: string;
};

/**
 * Service URLs for the child app. The shell forwards each one only when its
 * origin is in `childFrames.serviceOrigins`; anything else reaches the child as `null`.
 */
export type AppFrameServices = {
  email?: string | null;
  storage?: string | null;
  /** Files app URL, sent to the child as `settings.storage.filesUrl`. Needs `storage`. */
  files?: string | null;
  hosting?: string | null;
};

export type ChildFrameRegisterPayload = {
  frameId: string;
  url: string;
  backend: AppFrameBackend | null;
  services?: AppFrameServices;
};

export type AppFrameOptions = {
  /** Child app URL. Its origin is the only origin trusted for this frame. */
  url: string;
  /** Child identity server. Omit to let the shell decide (no token unless configured). */
  backend?: AppFrameBackend | null;
  /** Email-service URL for the child. Must be allowed by `childFrames.serviceOrigins`. */
  email?: string | null;
  /** Storage-service URL for the child. Must be allowed by `childFrames.serviceOrigins`. */
  storage?: string | null;
  /** Files app URL (`settings.storage.filesUrl`). Needs `storage`. Must be allowed by `childFrames.serviceOrigins`. */
  files?: string | null;
  /** Hosting-service URL for the child. Must be allowed by `childFrames.serviceOrigins`. */
  hosting?: string | null;
  /** Called when the child app changes its own URL. */
  onNavigate?: (location: ShellUIUrlPayload) => void;
  /** Called each time the child app finishes Shellui init (`SHELLUI_INITIALIZED`). */
  onReady?: () => void;
  /** Called when the shell reports whether the child got a session (failure includes a reason). */
  onSession?: (status: AppFrameSessionStatus) => void;
};

export type AppFrameHandle = {
  frameId: string;
  origin: string;
  destroy(): void;
};

export type AppFrameHost = {
  frameRegistry: FrameRegistry;
  messageSecurity: MessageSecurityPolicy;
  addMessageListener(
    type: string,
    listener: (message: ShellUIMessage, event: MessageEvent) => void,
  ): () => void;
  sendMessageToParent(message: ShellUIMessage): boolean;
};

/** Exact http(s) origin of `url`, or throws. */
export function appFrameOrigin(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('createAppFrame needs an absolute http(s) URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('createAppFrame needs an absolute http(s) URL');
  }
  return parsed.origin;
}

function cleanBackend(backend: AppFrameBackend | null | undefined): AppFrameBackend | null {
  if (!backend) return null;
  appFrameOrigin(backend.url);
  return {
    url: backend.url,
    ...(backend.companyId !== undefined && backend.companyId !== ''
      ? { companyId: backend.companyId }
      : {}),
    ...(backend.type ? { type: backend.type } : {}),
    ...(backend.provider ? { provider: backend.provider } : {}),
  };
}

function cleanServices(options: AppFrameOptions): AppFrameServices | undefined {
  const services: AppFrameServices = {};
  for (const key of ['email', 'storage', 'files', 'hosting'] as const) {
    const value = options[key]?.trim();
    if (value) services[key] = value;
  }
  return Object.keys(services).length ? services : undefined;
}

function isUrlPayload(value: unknown): value is ShellUIUrlPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.pathname === 'string';
}

/**
 * Register `iframe` as a child Shellui app of this window.
 * Call before or right after setting `iframe.src` to `options.url`.
 */
export function createAppFrameWith(
  host: AppFrameHost,
  iframe: HTMLIFrameElement,
  options: AppFrameOptions,
): AppFrameHandle {
  const origin = appFrameOrigin(options.url);
  const backend = cleanBackend(options.backend);
  const releaseOrigin = host.messageSecurity.allowFrameOrigin(origin);
  const frameId = host.frameRegistry.addIframe(iframe);

  const fromChild = (event: MessageEvent) =>
    Boolean(iframe.contentWindow) &&
    event.source === iframe.contentWindow &&
    event.origin === origin;

  const cleanups: Array<() => void> = [];
  cleanups.push(
    host.addMessageListener('SHELLUI_URL_CHANGED', (message, event) => {
      if (!fromChild(event) || !isUrlPayload(message.payload)) return;
      options.onNavigate?.(message.payload);
    }),
  );

  cleanups.push(
    host.addMessageListener('SHELLUI_INITIALIZED', (_message, event) => {
      if (!fromChild(event)) return;
      options.onReady?.();
    }),
  );

  cleanups.push(
    host.addMessageListener(CHILD_FRAME_SESSION, (message, event) => {
      // Only the shell (our parent) reports session results.
      if (typeof window === 'undefined' || event.source !== window.parent) return;
      const data = message.payload as unknown as Record<string, unknown> | null;
      if (!data || data.frameId !== frameId || typeof data.ok !== 'boolean') return;
      const status: AppFrameSessionStatus = {
        ok: data.ok,
        ...(typeof data.reason === 'string' ? { reason: data.reason } : {}),
        ...(typeof data.hint === 'string' ? { hint: data.hint } : {}),
      };
      if (status.ok) {
        logger.info('Child app session ready', { origin });
      } else {
        logger.warn('Child app has no session', { origin, ...status });
      }
      options.onSession?.(status);
    }),
  );

  const services = cleanServices(options);
  const payload: ChildFrameRegisterPayload = {
    frameId,
    url: options.url,
    backend,
    ...(services ? { services } : {}),
  };
  host.sendMessageToParent({
    type: CHILD_FRAME_REGISTER,
    payload: payload as unknown as ShellUIMessage['payload'],
  });

  let destroyed = false;
  return {
    frameId,
    origin,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cleanups.forEach((cleanup) => cleanup());
      host.frameRegistry.removeIframe(frameId);
      releaseOrigin();
      host.sendMessageToParent({
        type: CHILD_FRAME_UNREGISTER,
        payload: { frameId } as unknown as ShellUIMessage['payload'],
      });
    },
  };
}
