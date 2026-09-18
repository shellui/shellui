import { describe, expect, test } from 'vitest';
import { LEGACY_POPUP_ESCAPE_TOKEN, resolveContentIframeSandbox } from './contentIframeSandbox';

describe('resolveContentIframeSandbox', () => {
  test('uses tightened sandbox without popup escape', () => {
    const sandbox = resolveContentIframeSandbox('http://localhost:5173/', 'http://localhost:4000');
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).not.toContain(LEGACY_POPUP_ESCAPE_TOKEN);
  });

  test('same-origin production companion uses the same tightened set', () => {
    const sandbox = resolveContentIframeSandbox('/app/', 'https://example.com');
    expect(sandbox).not.toContain(LEGACY_POPUP_ESCAPE_TOKEN);
    expect(sandbox.split(' ').sort()).toEqual(
      ['allow-forms', 'allow-popups', 'allow-same-origin', 'allow-scripts'].sort(),
    );
  });

  test('falls back safely for invalid URLs', () => {
    const sandbox = resolveContentIframeSandbox('not-a-valid-url', 'http://localhost:4000');
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).not.toContain(LEGACY_POPUP_ESCAPE_TOKEN);
  });
});
