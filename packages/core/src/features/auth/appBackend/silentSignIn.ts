import urls from '../../../constants/urls';
import { SHELLUI_AUTH_CODE_PARAM } from '../constants/oauth';
import {
  getShellUILoginClientTimezone,
  getShellUILoginCompanyId,
  getShellUILoginDeviceId,
} from '../utils/clientLoginContext';
import { PKCE_CHALLENGE_METHOD } from '../utils/desktopSignIn';
import { createPkcePair } from '../utils/pkce';

export const SILENT_AUTH_QUERY = 'shellui_silent';
export const SILENT_AUTH_STATE_QUERY = 'shellui_silent_state';
export const SILENT_AUTH_RESULT_TYPE = 'SHELLUI_SILENT_AUTH_RESULT';

const DEFAULT_SILENT_TIMEOUT_MS = 15_000;

export function isSilentAuthCallbackSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return (
    params.get(SILENT_AUTH_QUERY) === '1' && Boolean(params.get(SILENT_AUTH_STATE_QUERY)?.trim())
  );
}

/** True inside the hidden frame that completes sign-in for another identity server. */
export function isSilentAuthCallbackFrame(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.parent === window) return false;
  return isSilentAuthCallbackSearch(window.location.search);
}

export type SilentAuthResult =
  | { ok: true; authCode: string }
  | { ok: false; error: string; errorCode: string | null };

/**
 * Accept a silent-auth result only from the frame we opened, on this origin, for this state.
 * A `*` target is never treated as a match.
 */
export function readSilentAuthMessage(
  event: { origin: string; source: unknown; data: unknown },
  expected: { origin: string; source: unknown; state: string },
): SilentAuthResult | null {
  if (!expected.origin || expected.origin === 'null' || expected.origin === '*') return null;
  if (!expected.state) return null;
  if (event.origin !== expected.origin) return null;
  if (event.source === null || event.source === undefined || event.source !== expected.source) {
    return null;
  }
  if (!event.data || typeof event.data !== 'object') return null;
  const record = event.data as Record<string, unknown>;
  if (record.type !== SILENT_AUTH_RESULT_TYPE) return null;
  if (record.state !== expected.state) return null;
  const authCode = typeof record.authCode === 'string' ? record.authCode.trim() : '';
  if (authCode) return { ok: true, authCode };
  const error =
    typeof record.error === 'string' && record.error.trim()
      ? record.error.trim()
      : 'silent_sign_in_failed';
  const errorCode = typeof record.errorCode === 'string' ? record.errorCode : null;
  return { ok: false, error, errorCode };
}

/**
 * Hand the one-time code to the same-origin shell. Does not exchange it.
 * Returns true when this document is the silent callback, including when the
 * parent is cross-origin and the code must not be posted.
 */
export function publishSilentAuthCallbackResult(win: Window = window): boolean {
  if (win.parent === win) return false;
  if (!isSilentAuthCallbackSearch(win.location.search)) return false;

  let parentOrigin: string | null = null;
  try {
    parentOrigin = win.parent.location.origin;
  } catch {
    parentOrigin = null;
  }
  const ownOrigin = win.location.origin;
  if (!parentOrigin || parentOrigin !== ownOrigin || parentOrigin === '*') {
    return true;
  }

  const params = new URLSearchParams(win.location.search);
  const payload = {
    type: SILENT_AUTH_RESULT_TYPE,
    state: params.get(SILENT_AUTH_STATE_QUERY) ?? '',
    authCode: params.get(SHELLUI_AUTH_CODE_PARAM),
    error: params.get('error') || params.get('shellui_oauth_error'),
    errorCode: params.get('error') || params.get('shellui_oauth_error_code'),
  };
  win.parent.postMessage(payload, parentOrigin);
  return true;
}

export function buildSilentAuthorizeUrl(input: {
  backendUrl: string;
  provider: string;
  redirectTo: string;
  codeChallenge: string;
  companyId?: string | number;
  clientTimezone?: string;
  clientDeviceId?: string;
}): string {
  const authorizeUrl = new URL(`${input.backendUrl.replace(/\/+$/, '')}/api/v1/authorize`);
  authorizeUrl.searchParams.set('provider', input.provider);
  authorizeUrl.searchParams.set('redirect_to', input.redirectTo);
  authorizeUrl.searchParams.set('code_challenge', input.codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', PKCE_CHALLENGE_METHOD);
  authorizeUrl.searchParams.set('prompt', 'none');
  authorizeUrl.searchParams.set('token_delivery', 'code');
  const companyId = getShellUILoginCompanyId(input.companyId);
  if (companyId) authorizeUrl.searchParams.set('company_id', companyId);
  if (input.clientTimezone) authorizeUrl.searchParams.set('client_timezone', input.clientTimezone);
  if (input.clientDeviceId) authorizeUrl.searchParams.set('client_device_id', input.clientDeviceId);
  return authorizeUrl.toString();
}

export type SilentSignInOutcome =
  | { ok: true; authCode: string; redirectTo: string; codeVerifier: string }
  | { ok: false; reason: string };

export type SilentAuthFrame = {
  contentWindow: unknown;
  remove: () => void;
};

export type SilentAuthHost = {
  origin: string;
  callbackPath: string;
  timeoutMs?: number;
  createFrame: (src: string) => SilentAuthFrame;
  listen: (fn: (event: { origin: string; source: unknown; data: unknown }) => void) => () => void;
  clientTimezone?: string;
  clientDeviceId?: string;
};

function browserSilentHost(): SilentAuthHost {
  return {
    origin: window.location.origin,
    callbackPath: urls.loginCallback,
    timeoutMs: DEFAULT_SILENT_TIMEOUT_MS,
    clientTimezone: getShellUILoginClientTimezone() || undefined,
    clientDeviceId: getShellUILoginDeviceId() || undefined,
    listen(fn) {
      const handler = (event: MessageEvent) => {
        fn({ origin: event.origin, source: event.source, data: event.data });
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    },
    createFrame(src) {
      const iframe = document.createElement('iframe');
      iframe.title = 'Identity sign-in';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      iframe.style.cssText =
        'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(iframe);
      const handle = {
        contentWindow: iframe.contentWindow,
        remove() {
          iframe.remove();
        },
      };
      // Navigate after the caller stores this handle so a fast callback can be matched.
      queueMicrotask(() => {
        iframe.src = src;
      });
      return handle;
    },
  };
}

/**
 * PKCE sign-in in a hidden frame. `prompt=none` asks the identity server not to
 * show UI. The verifier stays in the shell. The frame only posts the one-time code.
 */
export async function runSilentPkceSignIn(
  input: {
    backendUrl: string;
    provider: string;
    companyId?: string | number;
  },
  host: SilentAuthHost = browserSilentHost(),
): Promise<SilentSignInOutcome> {
  if (!host.origin || host.origin === '*' || host.origin === 'null') {
    return { ok: false, reason: 'invalid_origin' };
  }
  const provider = input.provider.trim().toLowerCase();
  if (!provider) return { ok: false, reason: 'missing_provider' };

  const { verifier, challenge } = await createPkcePair();
  const state =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const redirectTo = `${host.origin}${host.callbackPath}?${SILENT_AUTH_QUERY}=1&${SILENT_AUTH_STATE_QUERY}=${encodeURIComponent(state)}`;
  const authorizeUrl = buildSilentAuthorizeUrl({
    backendUrl: input.backendUrl,
    provider,
    redirectTo,
    codeChallenge: challenge,
    companyId: input.companyId,
    clientTimezone: host.clientTimezone,
    clientDeviceId: host.clientDeviceId,
  });

  return new Promise((resolve) => {
    let settled = false;
    let frame: SilentAuthFrame | null = null;
    let stop = () => {};
    const finish = (outcome: SilentSignInOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stop();
      frame?.remove();
      resolve(outcome);
    };
    const timer = setTimeout(
      () => finish({ ok: false, reason: 'timeout' }),
      host.timeoutMs ?? DEFAULT_SILENT_TIMEOUT_MS,
    );
    stop = host.listen((event) => {
      if (!frame?.contentWindow) return;
      const result = readSilentAuthMessage(event, {
        origin: host.origin,
        source: frame.contentWindow,
        state,
      });
      if (!result) return;
      if (!result.ok) {
        finish({ ok: false, reason: result.errorCode || result.error });
        return;
      }
      finish({ ok: true, authCode: result.authCode, redirectTo, codeVerifier: verifier });
    });
    frame = host.createFrame(authorizeUrl);
  });
}
