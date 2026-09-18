/**
 * Embedded companions must receive SHELLUI_SETTINGS before paint.
 * One quick retry + a short timeout so init() cannot hang when the shell
 * drops the first SETTINGS_REQUESTED — without spamming the shell logs.
 */

export const SETTINGS_HANDSHAKE_TIMEOUT_MS = 1500;
export const SETTINGS_REQUEST_RETRY_MS = 500;
export const SETTINGS_REQUEST_MAX_ATTEMPTS = 2;

export type InitialSettingsHandshakeResult = 'received' | 'timeout' | 'skipped';

export type WaitForInitialSettingsOptions = {
  isEmbedded: boolean;
  /** Send SHELLUI_SETTINGS_REQUESTED (or equivalent) to the shell. */
  requestSettings: () => void;
  /** Subscribe to the first SHELLUI_SETTINGS; return an unsubscribe. */
  onSettings: (listener: () => void) => () => void;
  timeoutMs?: number;
  retryMs?: number;
  maxAttempts?: number;
  onTimeout?: () => void;
  /** Optional scheduler hooks for tests. */
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearSchedule?: (id: ReturnType<typeof setTimeout>) => void;
};

export function waitForInitialSettings(
  options: WaitForInitialSettingsOptions,
): Promise<InitialSettingsHandshakeResult> {
  if (!options.isEmbedded) {
    return Promise.resolve('skipped');
  }

  const timeoutMs = options.timeoutMs ?? SETTINGS_HANDSHAKE_TIMEOUT_MS;
  const retryMs = options.retryMs ?? SETTINGS_REQUEST_RETRY_MS;
  const maxAttempts = options.maxAttempts ?? SETTINGS_REQUEST_MAX_ATTEMPTS;
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const clearSchedule = options.clearSchedule ?? ((id) => clearTimeout(id));

  return new Promise((resolve) => {
    let settled = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: InitialSettingsHandshakeResult) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      if (retryTimer !== null) clearSchedule(retryTimer);
      if (timeoutTimer !== null) clearSchedule(timeoutTimer);
      if (result === 'timeout') {
        options.onTimeout?.();
      }
      resolve(result);
    };

    const unsubscribe = options.onSettings(() => {
      finish('received');
    });

    const request = () => {
      if (settled) return;
      attempt += 1;
      options.requestSettings();
      if (attempt < maxAttempts) {
        retryTimer = schedule(request, retryMs);
      }
    };

    timeoutTimer = schedule(() => {
      finish('timeout');
    }, timeoutMs);

    request();
  });
}
