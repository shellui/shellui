import { describe, expect, it, vi } from 'vitest';
import {
  waitForInitialSettings,
  SETTINGS_HANDSHAKE_TIMEOUT_MS,
  SETTINGS_REQUEST_RETRY_MS,
} from './waitForInitialSettings.js';

describe('waitForInitialSettings', () => {
  it('skips when not embedded', async () => {
    const requestSettings = vi.fn();
    const result = await waitForInitialSettings({
      isEmbedded: false,
      requestSettings,
      onSettings: () => () => undefined,
    });
    expect(result).toBe('skipped');
    expect(requestSettings).not.toHaveBeenCalled();
  });

  it('resolves when SHELLUI_SETTINGS arrives', async () => {
    let settingsListener: (() => void) | null = null;
    const requestSettings = vi.fn();

    const promise = waitForInitialSettings({
      isEmbedded: true,
      requestSettings,
      onSettings: (listener) => {
        settingsListener = listener;
        return () => {
          settingsListener = null;
        };
      },
      timeoutMs: 5000,
      retryMs: 10_000,
      maxAttempts: 1,
    });

    expect(requestSettings).toHaveBeenCalledTimes(1);
    settingsListener?.();
    await expect(promise).resolves.toBe('received');
  });

  it('retries SETTINGS_REQUESTED until settings arrive', async () => {
    vi.useFakeTimers();
    try {
      let settingsListener: (() => void) | null = null;
      const requestSettings = vi.fn();

      const promise = waitForInitialSettings({
        isEmbedded: true,
        requestSettings,
        onSettings: (listener) => {
          settingsListener = listener;
          return () => {
            settingsListener = null;
          };
        },
        timeoutMs: 10_000,
        retryMs: SETTINGS_REQUEST_RETRY_MS,
        maxAttempts: 5,
      });

      expect(requestSettings).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(SETTINGS_REQUEST_RETRY_MS);
      expect(requestSettings).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(SETTINGS_REQUEST_RETRY_MS);
      expect(requestSettings).toHaveBeenCalledTimes(3);

      settingsListener?.();
      await expect(promise).resolves.toBe('received');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves on timeout so init cannot hang forever', async () => {
    vi.useFakeTimers();
    try {
      const onTimeout = vi.fn();
      const requestSettings = vi.fn();

      const promise = waitForInitialSettings({
        isEmbedded: true,
        requestSettings,
        onSettings: () => () => undefined,
        onTimeout,
        timeoutMs: SETTINGS_HANDSHAKE_TIMEOUT_MS,
        retryMs: SETTINGS_REQUEST_RETRY_MS,
        maxAttempts: 2,
      });

      await vi.advanceTimersByTimeAsync(SETTINGS_HANDSHAKE_TIMEOUT_MS);
      await expect(promise).resolves.toBe('timeout');
      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(requestSettings).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
