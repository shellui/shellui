// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

describe('tiny settings messages', () => {
  it('applies SHELLUI_SETTINGS only from window.parent with a verified origin', async () => {
    let readableOrigin: string | null = null;
    const parentWindow = { postMessage() {} } as unknown as Window;
    Object.defineProperty(parentWindow, 'location', {
      configurable: true,
      get() {
        if (!readableOrigin) throw new DOMException('Blocked', 'SecurityError');
        return { origin: readableOrigin };
      },
    });
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => parentWindow,
    });

    const { shellui } = await import('./tiny.js');

    const deliver = (
      origin: string,
      source: Window,
      language: string,
      type = 'SHELLUI_SETTINGS',
    ) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type,
            payload: { settings: { language: { code: language } } },
          },
          origin,
          source,
        }),
      );
    };

    deliver('https://evil.example', parentWindow, 'fr');
    expect(shellui.language).toBeNull();

    readableOrigin = 'https://shell.example';
    deliver('https://evil.example', parentWindow, 'de', 'SHELLUI_SETTINGS_UPDATED');
    expect(shellui.language).toBeNull();

    deliver('https://shell.example', window, 'es');
    expect(shellui.language).toBeNull();

    deliver('https://shell.example', parentWindow, 'fr');
    expect(shellui.language).toBe('fr');
  });
});
