import type { Settings } from '../types.js';

/** Ask the shell for a new access token this many seconds before JWT `exp`. */
export const EMBEDDED_TOKEN_REFRESH_LEEWAY_SECONDS = 90;

const SESSION_REQUEST_COOLDOWN_MS = 1000;

/**
 * Extra handoff after the app has mounted its settings listener.
 * The first post can land before React's useEffect subscribes.
 */
export const SESSION_HANDOFF_RETRY_MS = 250;

export type ResumeTarget = {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

export type VisibleResumeScope = {
  document: ResumeTarget & { visibilityState?: DocumentVisibilityState };
  window: ResumeTarget;
};

/** Seconds-since-epoch `exp` from a JWT, or null when the token is missing or opaque. */
export function readJwtExp(token: string | null | undefined): number | null {
  if (!token) return null;
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const json = atob(padded + pad);
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(
  token: string | null | undefined,
  nowSeconds: number,
  leewaySeconds = EMBEDDED_TOKEN_REFRESH_LEEWAY_SECONDS,
): boolean {
  const exp = readJwtExp(token);
  if (exp === null) return false;
  return exp - nowSeconds <= leewaySeconds;
}

export type ReconciledEmbeddedSettings = {
  settings: Settings;
  /** Shell sent a user but omitted the access token. Ask again instead of clearing it. */
  requestFreshToken: boolean;
};

/**
 * Keep the last access token when a later settings payload drops it while the
 * user is still present. A payload with `user: null` and no token is logout.
 */
export function reconcileEmbeddedAccessToken(
  previous: Settings | null,
  incoming: Settings,
  nowSeconds: number,
): ReconciledEmbeddedSettings {
  const incomingToken = incoming.accessToken ?? null;
  const previousToken = previous?.accessToken ?? null;
  const loggedOut = incoming.user === null && !incomingToken;

  if (loggedOut) {
    return {
      settings: { ...incoming, accessToken: null },
      requestFreshToken: false,
    };
  }

  if (!incomingToken && previousToken) {
    return {
      settings: { ...incoming, accessToken: previousToken },
      requestFreshToken: true,
    };
  }

  if (incomingToken && isAccessTokenExpired(incomingToken, nowSeconds)) {
    return { settings: incoming, requestFreshToken: true };
  }

  return { settings: incoming, requestFreshToken: false };
}

/**
 * Run `onResume` when the document becomes visible, gains focus while visible,
 * or is restored (`pageshow`, including back-forward cache).
 */
export function bindVisibleResume(onResume: () => void, scope?: VisibleResumeScope): () => void {
  const doc = scope?.document ?? document;
  const win = scope?.window ?? window;

  const onVisible = () => {
    if (doc.visibilityState && doc.visibilityState !== 'visible') return;
    onResume();
  };
  const onPageShow = () => {
    onResume();
  };

  doc.addEventListener('visibilitychange', onVisible);
  win.addEventListener('focus', onVisible);
  win.addEventListener('pageshow', onPageShow);

  return () => {
    doc.removeEventListener('visibilitychange', onVisible);
    win.removeEventListener('focus', onVisible);
    win.removeEventListener('pageshow', onPageShow);
  };
}

/**
 * Send now, on the next turn, and once more after
 * `SESSION_HANDOFF_RETRY_MS` so a listener that mounts with the app still receives it.
 */
export function deliverSessionHandoff(
  send: () => void,
  schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = (fn, ms) =>
    setTimeout(fn, ms),
  clear: (id: ReturnType<typeof setTimeout>) => void = (id) => clearTimeout(id),
): () => void {
  const stopSoon = runNowAndSoon(send, schedule, clear);
  const later = schedule(send, SESSION_HANDOFF_RETRY_MS);
  return () => {
    stopSoon();
    clear(later);
  };
}

/** Run immediately, then once on the next turn so a listener mounted in between still sees it. */
export function runNowAndSoon(
  run: () => void,
  schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = (fn, ms) =>
    setTimeout(fn, ms),
  clear: (id: ReturnType<typeof setTimeout>) => void = (id) => clearTimeout(id),
): () => void {
  run();
  const id = schedule(run, 0);
  return () => clear(id);
}

export function createSessionRequestGate(cooldownMs = SESSION_REQUEST_COOLDOWN_MS): {
  request: (send: () => void, force?: boolean) => void;
} {
  let lastMs = 0;
  return {
    request(send, force = false) {
      const now = Date.now();
      if (!force && now - lastMs < cooldownMs) return;
      lastMs = now;
      send();
    },
  };
}
