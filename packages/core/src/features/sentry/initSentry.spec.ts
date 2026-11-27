import { beforeEach, describe, expect, it, vi } from 'vitest';
import source from './initSentry.ts?raw';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  close: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@sentry/react', () => sentry);
vi.mock('@shellui/config', () => ({
  default: { sentry: { dsn: 'https://key@example.invalid/1', environment: 'test' } },
}));
vi.mock('../cookieConsent/cookieConsent', () => ({
  getCookieConsentAccepted: () => true,
}));

describe('Sentry init', () => {
  beforeEach(() => {
    vi.resetModules();
    sentry.init.mockReset();
  });

  it('passes the same privacy-minimal dataCollection in every Sentry.init call', async () => {
    const { SENTRY_DATA_COLLECTION } = await import('./initSentry');
    expect(SENTRY_DATA_COLLECTION).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    });
    // The env check in initSentry() cannot be switched off under Vitest, so check the source:
    // every Sentry.init call (there are two) carries the constant and none the removed option.
    const calls = source.match(/Sentry\.init\(\{[\s\S]*?\}\);/g) ?? [];
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call).toContain('dataCollection: SENTRY_DATA_COLLECTION');
      expect(call).not.toContain('sendDefaultPii');
    }
  });

  it('uses the same dataCollection when a manual report initializes Sentry', async () => {
    const { captureException, SENTRY_DATA_COLLECTION } = await import('./initSentry');
    await captureException(new Error('probe'));
    expect(sentry.init).toHaveBeenCalledTimes(1);
    const options = sentry.init.mock.calls[0][0];
    expect(options).not.toHaveProperty('sendDefaultPii');
    expect(options.dataCollection).toBe(SENTRY_DATA_COLLECTION);
    expect(sentry.captureException).toHaveBeenCalled();
  });
});
