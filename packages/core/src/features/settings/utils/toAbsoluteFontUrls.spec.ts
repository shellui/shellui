import { afterEach, describe, expect, it, vi } from 'vitest';
import { toAbsoluteFontUrls } from './toAbsoluteFontUrls';

describe('toAbsoluteFontUrls', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps absolute urls unchanged and normalizes relative ones', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://shellui.dev' },
    });

    expect(
      toAbsoluteFontUrls([
        'https://cdn.example.com/font.css',
        'fonts/local.woff2',
        '/fonts/a.woff2',
      ]),
    ).toEqual([
      'https://cdn.example.com/font.css',
      'https://shellui.dev/fonts/local.woff2',
      'https://shellui.dev/fonts/a.woff2',
    ]);
  });
});
