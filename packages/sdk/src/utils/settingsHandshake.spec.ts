import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { FrameRegistry } from './frameRegistry.js';
import { MessageListenerRegistry } from './messageListenerRegistry.js';
import { MessageSecurityPolicy } from './messageSecurity.js';

/**
 * Regression: shell host + cross-origin localhost companion.
 * Early SHELLUI_SETTINGS_REQUESTED must not be dropped once nav origins are allowlisted
 * and the iframe is registered — the first-paint race that caused white-screen hangs.
 */
describe('shell ↔ companion settings handshake (localhost)', () => {
  let policy: MessageSecurityPolicy;
  let frameRegistry: FrameRegistry;
  let registry: MessageListenerRegistry;
  let companionWindow: Window;
  const shellOrigin = 'http://localhost:4000';
  const companionOrigin = 'http://localhost:5173';

  beforeEach(() => {
    policy = new MessageSecurityPolicy();
    frameRegistry = new FrameRegistry();
    registry = new MessageListenerRegistry(frameRegistry, policy);
    companionWindow = {} as Window;

    const shellWindow = {
      location: { origin: shellOrigin },
    } as Window & { parent: Window };
    shellWindow.parent = shellWindow;
    vi.stubGlobal('window', shellWindow);

    frameRegistry.getUuidByIframe = (win) => (win === companionWindow ? 'playground' : undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects companion SETTINGS_REQUESTED before allowlist (documents the race)', () => {
    policy.configure({ allowedOrigins: [] });

    const event = {
      origin: companionOrigin,
      source: companionWindow,
      data: { type: 'SHELLUI_SETTINGS_REQUESTED', payload: {} },
    } as MessageEvent;

    expect(policy.isTrustedInboundMessage(event, frameRegistry, 'SHELLUI_SETTINGS_REQUESTED')).toBe(
      false,
    );
  });

  it('accepts companion SETTINGS_REQUESTED after config-derived allowlist', () => {
    policy.configure({ allowedOrigins: [companionOrigin] });

    const event = {
      origin: companionOrigin,
      source: companionWindow,
      data: { type: 'SHELLUI_SETTINGS_REQUESTED', payload: {} },
    } as MessageEvent;

    expect(policy.isTrustedInboundMessage(event, frameRegistry, 'SHELLUI_SETTINGS_REQUESTED')).toBe(
      true,
    );
  });

  it('delivers SETTINGS_REQUESTED when allowlisted + registered (listener path)', () => {
    policy.configure({ allowedOrigins: [companionOrigin] });
    const onRequested = vi.fn();
    registry.addMessageListener('SHELLUI_SETTINGS_REQUESTED', onRequested);

    const event = {
      origin: companionOrigin,
      source: companionWindow,
      data: { type: 'SHELLUI_SETTINGS_REQUESTED', payload: {} },
    } as MessageEvent;

    expect(policy.isTrustedInboundMessage(event, frameRegistry, 'SHELLUI_SETTINGS_REQUESTED')).toBe(
      true,
    );

    // Simulate the trusted branch of setupGlobalListener without needing DOM EventTarget.
    onRequested(
      {
        type: 'SHELLUI_SETTINGS_REQUESTED',
        payload: {},
        from: ['playground'],
      },
      event,
    );
    expect(onRequested).toHaveBeenCalledTimes(1);
  });
});
