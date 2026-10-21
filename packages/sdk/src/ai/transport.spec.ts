import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearParentTargetOriginHints } from '../utils/messageSecurity.js';
import { createAiPostMessageTransport } from './transport.js';

describe('AI postMessage transport', () => {
  afterEach(() => {
    clearParentTargetOriginHints();
    vi.unstubAllGlobals();
  });

  it('does not post SHELLUI_AI_REQUEST to the parent with *', () => {
    const postMessage = vi.fn();
    const parent = { postMessage } as unknown as Window;
    vi.stubGlobal('window', {
      parent,
      location: { origin: 'http://localhost:5173' },
      setTimeout: () => 0,
      clearTimeout: () => undefined,
    });
    vi.stubGlobal('document', { referrer: '', location: { ancestorOrigins: undefined } });

    const transport = createAiPostMessageTransport({
      addMessageListener: () => () => undefined,
    });
    void transport.request({ prompt: 'hello' } as never);

    expect(postMessage).not.toHaveBeenCalled();
  });
});
