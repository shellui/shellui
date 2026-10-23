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
import type { AppFrameBackend } from './utils/appFrame.js';
import type { ShellUIUrlPayload } from './types.js';

/** Time the child app has to finish Shellui init before the error state shows. */
export const SHELLUI_FRAME_READY_TIMEOUT_MS = 20_000;

export type ShelluiFrameStatus = 'loading' | 'ready' | 'error';

export type ShelluiFrameProps = Omit<IframeHTMLAttributes<HTMLIFrameElement>, 'src'> & {
  /** Child app URL, including any deep-link path. A new value reloads the frame. */
  src: string;
  /** Child identity server. The shell must allow it in config. */
  backend?: AppFrameBackend | null;
  /** The child app changed its URL. Mirror it in the host route here. */
  onNavigate?: (location: ShellUIUrlPayload) => void;
  /** Shown over the hidden frame until the child app finishes Shellui init. */
  fallback?: ReactNode;
  /** Shown when init does not arrive in time. Call `retry` to reload the frame. */
  renderError?: (retry: () => void) => ReactNode;
  /** Defaults to `SHELLUI_FRAME_READY_TIMEOUT_MS`. */
  readyTimeoutMs?: number;
  /** Class for the wrapper that holds the frame and the overlay. */
  containerClassName?: string;
  onStatusChange?: (status: ShelluiFrameStatus) => void;
};

const fill: CSSProperties = { position: 'absolute', inset: 0 };

function defaultLoading(): ReactNode {
  return createElement('div', { 'data-shellui-frame-loading': '', role: 'status' }, 'Loading…');
}

function defaultError(retry: () => void): ReactNode {
  return createElement(
    'div',
    { 'data-shellui-frame-error': '', role: 'alert' },
    createElement('p', null, 'This app did not load.'),
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

  useEffect(() => {
    statusRef.current?.(status);
  }, [status]);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    setStatus('loading');
    let ready = false;
    const handle = createAppFrame(iframe, {
      url: src,
      backend: backendUrl
        ? {
            url: backendUrl,
            ...(companyId !== '' ? { companyId } : {}),
            ...(backendType ? { type: backendType as AppFrameBackend['type'] } : {}),
            ...(provider ? { provider } : {}),
          }
        : null,
      onNavigate: (location) => navigateRef.current?.(location),
      onReady: () => {
        ready = true;
        setStatus('ready');
      },
    });
    // Load (or reload) after registering so the first child message is trusted.
    iframe.src = src;
    const timer = setTimeout(() => {
      if (!ready) setStatus('error');
    }, readyTimeoutMs);
    return () => {
      clearTimeout(timer);
      handle.destroy();
    };
  }, [src, backendUrl, companyId, backendType, provider, attempt, readyTimeoutMs]);

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
            ? (renderError ?? defaultError)(retry)
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
