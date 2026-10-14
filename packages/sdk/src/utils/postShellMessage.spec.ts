import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearParentTargetOriginHints, MessageSecurityPolicy } from './messageSecurity.js';
import { postShellMessage } from './postShellMessage.js';

describe('postShellMessage', () => {
  afterEach(() => {
    clearParentTargetOriginHints();
    vi.unstubAllGlobals();
  });

  it('does not post to the parent when the parent origin is unknown', () => {
    const postMessage = vi.fn();
    const parent = { postMessage } as unknown as Window;
    vi.stubGlobal('window', {
      parent,
      location: { origin: 'http://localhost:5173' },
    });
    vi.stubGlobal('document', { referrer: '', location: { ancestorOrigins: undefined } });

    postShellMessage({ type: 'SHELLUI_SETTINGS_REQUESTED', payload: {} });

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('posts to the known parent origin and never to *', () => {
    const postMessage = vi.fn();
    const parent = { postMessage } as unknown as Window;
    vi.stubGlobal('window', {
      parent,
      location: { origin: 'http://localhost:5173' },
    });
    vi.stubGlobal('document', { referrer: '', location: { ancestorOrigins: undefined } });
    new MessageSecurityPolicy().configure({ allowedOrigins: ['http://localhost:4000'] });

    postShellMessage({ type: 'SHELLUI_SETTINGS_REQUESTED', payload: {} });

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0]?.[1]).toBe('http://localhost:4000');
    expect(postMessage.mock.calls[0]?.[1]).not.toBe('*');
  });
});
