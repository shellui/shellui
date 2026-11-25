import { describe, expect, test } from 'vitest';
import { LEGACY_POPUP_ESCAPE_TOKEN, resolveContentIframeSandbox } from './contentIframeSandbox';

const WITH_ORIGIN = ['allow-forms', 'allow-popups', 'allow-same-origin', 'allow-scripts'];
const OPAQUE = ['allow-forms', 'allow-popups', 'allow-scripts'];

describe('resolveContentIframeSandbox', () => {
  test('keeps allow-same-origin for a cross-origin dev companion', () => {
    const sandbox = resolveContentIframeSandbox('http://localhost:5173/', 'http://localhost:4000');
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).not.toContain(LEGACY_POPUP_ESCAPE_TOKEN);
    expect(sandbox.split(' ').sort()).toEqual([...WITH_ORIGIN].sort());
  });

  test('keeps allow-same-origin for a same-origin /app/ companion', () => {
    const sandbox = resolveContentIframeSandbox('/app/', 'https://example.com');
    expect(sandbox).not.toContain(LEGACY_POPUP_ESCAPE_TOKEN);
    expect(sandbox.split(' ').sort()).toEqual([...WITH_ORIGIN].sort());
  });

  test('keeps allow-same-origin for same-origin hash content routes (admin nested pages)', () => {
    const origin = 'https://admin.example.com';
    expect(resolveContentIframeSandbox(`${origin}/#/agents`, origin).split(' ').sort()).toEqual(
      [...WITH_ORIGIN].sort(),
    );
    expect(resolveContentIframeSandbox('#/users', origin).split(' ').sort()).toEqual(
      [...WITH_ORIGIN].sort(),
    );
  });

  test('keeps allow-same-origin for shell pages on the shell origin', () => {
    expect(
      resolveContentIframeSandbox('/__settings/ai', 'https://example.com').split(' ').sort(),
    ).toEqual([...WITH_ORIGIN].sort());
    expect(
      resolveContentIframeSandbox('/__cookie-preferences', 'https://example.com').split(' ').sort(),
    ).toEqual([...WITH_ORIGIN].sort());
  });

  test('keeps allow-same-origin for custom desktop shell schemes', () => {
    expect(
      resolveContentIframeSandbox('/app#/dialog', 'tauri://localhost').split(' ').sort(),
    ).toEqual([...WITH_ORIGIN].sort());
  });

  test('omits allow-same-origin when the URL cannot be parsed or is empty', () => {
    for (const bad of ['http://[', '']) {
      const sandbox = resolveContentIframeSandbox(bad, 'http://localhost:4000');
      expect(sandbox).toContain('allow-scripts');
      expect(sandbox).not.toContain('allow-same-origin');
      expect(sandbox).not.toContain(LEGACY_POPUP_ESCAPE_TOKEN);
      expect(sandbox.split(' ').sort()).toEqual([...OPAQUE].sort());
    }
  });

  test('omits allow-same-origin for non-http(s) schemes such as data and javascript', () => {
    for (const bad of ['data:text/html,hi', 'javascript:void(0)']) {
      const sandbox = resolveContentIframeSandbox(bad, 'https://example.com');
      expect(sandbox).not.toContain('allow-same-origin');
      expect(sandbox).not.toContain(LEGACY_POPUP_ESCAPE_TOKEN);
      expect(sandbox.split(' ').sort()).toEqual([...OPAQUE].sort());
    }
  });
});
