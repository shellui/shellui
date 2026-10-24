/**
 * React binding for `createAppFrame`. Import from `@shellui/sdk/react`.
 */
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type IframeHTMLAttributes,
  type ReactNode,
} from 'react';
import { createAppFrame } from './index.js';
import {
  navigateApp,
  readAppLocation,
  subscribeAppLocation,
  type AppLocation,
} from './utils/appLocation.js';
import type { AppFrameBackend, AppFrameSessionStatus } from './utils/appFrame.js';
import type { ShellUIUrlPayload } from './types.js';

/** Time the child app has to finish Shellui init before the error state shows. */
export const SHELLUI_FRAME_READY_TIMEOUT_MS = 20_000;

export type ShelluiFrameStatus = 'loading' | 'ready' | 'error';

export type ShelluiFrameProps = Omit<IframeHTMLAttributes<HTMLIFrameElement>, 'src'> & {
  /**
   * Child app URL, including any deep-link path. A new value on the same origin
   * navigates the running child (no reload of the frame element, no re-register).
   * A value equal to the location the child just reported is ignored, so mirroring
   * child navigation into `src` never reloads the child.
   */
  src: string;
  /** Child identity server. The shell must allow it in config. */
  backend?: AppFrameBackend | null;
  /** Email-service URL for the child. The shell must allow its origin in `childFrames.serviceOrigins`. */
  email?: string | null;
  /** Storage-service URL for the child. Same rule as `email`. */
  storage?: string | null;
  /** Hosting-service URL for the child. Same rule as `email`. */
  hosting?: string | null;
  /** The child app changed its URL. Mirror it in the host route here. */
  onNavigate?: (location: ShellUIUrlPayload) => void;
  /** Shown over the hidden frame until the child app finishes Shellui init. */
  fallback?: ReactNode;
  /**
   * Shown when init does not arrive in time, or when the shell reports that the
   * child got no session (`error.reason`, `error.hint`). Call `retry` to try again.
   */
  renderError?: (retry: () => void, error?: AppFrameSessionStatus) => ReactNode;
  /** Defaults to `SHELLUI_FRAME_READY_TIMEOUT_MS`. */
  readyTimeoutMs?: number;
  /** Class for the wrapper that holds the frame and the overlay. */
  containerClassName?: string;
  onStatusChange?: (status: ShelluiFrameStatus) => void;
};

function frameOriginOrEmpty(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : '';
  } catch {
    return '';
  }
}

function normalizeHref(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return '';
  }
}

function hrefFromLocation(origin: string, location: ShellUIUrlPayload): string {
  return normalizeHref(
    `${origin}${location.pathname}${location.search ?? ''}${location.hash ?? ''}`,
  );
}

const fill: CSSProperties = { position: 'absolute', inset: 0 };

function defaultLoading(): ReactNode {
  return createElement('div', { 'data-shellui-frame-loading': '', role: 'status' }, 'Loading…');
}

function defaultError(retry: () => void, error?: AppFrameSessionStatus): ReactNode {
  return createElement(
    'div',
    { 'data-shellui-frame-error': error?.reason ?? '', role: 'alert' },
    createElement(
      'p',
      null,
      error?.reason ? 'This app could not sign in.' : 'This app did not load.',
    ),
    error?.reason ? createElement('p', null, error.hint || error.reason) : null,
    error?.reason && error.hint ? createElement('code', null, error.reason) : null,
    createElement('button', { type: 'button', onClick: retry }, 'Retry'),
  );
}

/**
 * Iframe managed by the Shellui SDK. Theme, language, session and child
 * messages flow through the shell. The frame stays hidden behind a loading
 * overlay until the child app confirms Shellui init.
 */
export function ShelluiFrame({
  src,
  backend,
  email,
  storage,
  hosting,
  onNavigate,
  fallback,
  renderError,
  readyTimeoutMs = SHELLUI_FRAME_READY_TIMEOUT_MS,
  containerClassName,
  onStatusChange,
  style,
  ...rest
}: ShelluiFrameProps) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;
  const statusRef = useRef(onStatusChange);
  statusRef.current = onStatusChange;
  const [status, setStatus] = useState<ShelluiFrameStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const backendUrl = backend?.url ?? '';
  const companyId = backend?.companyId ?? '';
  const backendType = backend?.type ?? '';
  const provider = backend?.provider ?? '';
  const emailUrl = email ?? '';
  const storageUrl = storage ?? '';
  const hostingUrl = hosting ?? '';

  useEffect(() => {
    statusRef.current?.(status);
  }, [status]);

  const [sessionError, setSessionError] = useState<AppFrameSessionStatus | undefined>();
  const srcRef = useRef(src);
  srcRef.current = src;
  /** Absolute URL the child is at (last loaded by us or reported by the child). */
  const childHrefRef = useRef<string | null>(null);
  const origin = frameOriginOrEmpty(src);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe || !origin) return;
    setStatus('loading');
    setSessionError(undefined);
    let ready = false;
    let sessionFailed = false;
    const initialSrc = srcRef.current;
    const handle = createAppFrame(iframe, {
      url: initialSrc,
      backend: backendUrl
        ? {
            url: backendUrl,
            ...(companyId !== '' ? { companyId } : {}),
            ...(backendType ? { type: backendType as AppFrameBackend['type'] } : {}),
            ...(provider ? { provider } : {}),
          }
        : null,
      ...(emailUrl ? { email: emailUrl } : {}),
      ...(storageUrl ? { storage: storageUrl } : {}),
      ...(hostingUrl ? { hosting: hostingUrl } : {}),
      onNavigate: (location) => {
        childHrefRef.current = hrefFromLocation(origin, location);
        navigateRef.current?.(location);
      },
      onReady: () => {
        ready = true;
        if (!sessionFailed) setStatus('ready');
      },
      onSession: (session) => {
        if (session.ok) return;
        sessionFailed = true;
        setSessionError(session);
        setStatus('error');
      },
    });
    // Load (or reload) after registering so the first child message is trusted.
    childHrefRef.current = normalizeHref(initialSrc);
    iframe.src = initialSrc;
    const timer = setTimeout(() => {
      if (!ready) setStatus('error');
    }, readyTimeoutMs);
    return () => {
      clearTimeout(timer);
      handle.destroy();
    };
  }, [
    origin,
    backendUrl,
    companyId,
    backendType,
    provider,
    emailUrl,
    storageUrl,
    hostingUrl,
    attempt,
    readyTimeoutMs,
  ]);

  // Host-driven navigation (back, forward, deep link): move the running child.
  // Never touches `src` again, so child-reported navigation cannot reload it.
  useEffect(() => {
    const iframe = ref.current;
    const target = normalizeHref(src);
    if (!iframe || !target || target === childHrefRef.current) return;
    if (frameOriginOrEmpty(target) !== origin) return;
    childHrefRef.current = target;
    try {
      iframe.contentWindow?.location.replace(target);
    } catch {
      // Detached frame; the next registration loads `src`.
    }
  }, [src, origin]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const hidden = status !== 'ready';

  return createElement(
    'div',
    {
      className: containerClassName,
      style: { position: 'relative', display: 'flex', minHeight: 0, minWidth: 0 },
      'data-shellui-frame-status': status,
    },
    createElement('iframe', {
      ...rest,
      ref,
      'aria-hidden': hidden || undefined,
      style: { ...style, visibility: hidden ? 'hidden' : 'visible' },
    }),
    hidden
      ? createElement(
          'div',
          { style: fill, 'data-shellui-frame-overlay': status },
          status === 'error'
            ? (renderError ?? defaultError)(retry, sessionError)
            : fallback !== undefined
              ? fallback
              : defaultLoading(),
        )
      : null,
  );
}

export type ShelluiNavigation = {
  location: AppLocation;
  /** Go to an app path such as `/companies/42`. Pass `replace` to skip a history entry. */
  navigate: (path: string, options?: { replace?: boolean }) => void;
};

/**
 * Two-way route sync with the shell for apps without a router library.
 * `navigate` changes the URL and the SDK reports it to the shell. Shell back, forward and
 * deep links update `location`. Pass Vite's `import.meta.env.BASE_URL` as `basePath`.
 */
export function useShelluiNavigation(basePath = '/'): ShelluiNavigation {
  const path = useSyncExternalStore(
    subscribeAppLocation,
    () => readAppLocation(basePath).path,
    () => '/',
  );
  const navigate = useCallback(
    (next: string, options?: { replace?: boolean }) =>
      navigateApp(next, { basePath, replace: options?.replace }),
    [basePath],
  );
  // The snapshot is the path string, so the location object only changes with the URL.
  const location = useMemo(() => readAppLocation(basePath), [path, basePath]);
  return { location, navigate };
}
