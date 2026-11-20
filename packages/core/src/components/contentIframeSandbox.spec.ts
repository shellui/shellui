import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  LEGACY_POPUP_ESCAPE_TOKEN,
  resetContentIframeSandboxWarnings,
  resolveContentIframeSandbox,
} from './contentIframeSandbox';

const WITH_ORIGIN = ['allow-forms', 'allow-popups', 'allow-same-origin', 'allow-scripts'];
const OPAQUE = ['allow-forms', 'allow-popups', 'allow-scripts'];

describe('resolveContentIframeSandbox', () => {
  afterEach(() => {
    resetContentIframeSandboxWarnings();
    vi.restoreAllMocks();
  });

  test('keeps allow-same-origin for a cross-origin dev companion', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sandbox = resolveContentIframeSandbox('http://localhost:5173/', 'http://localhost:4000');
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).not.toContain(LEGACY_POPUP_ESCAPE_TOKEN);
    expect(sandbox.split(' ').sort()).toEqual([...WITH_ORIGIN].sort());
    expect(warn).not.toHaveBeenCalled();
  });

  test('omits allow-same-origin for a same-origin production companion and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sandbox = resolveContentIframeSandbox('/app/', 'https://example.com');
    expect(sandbox).not.toContain(LEGACY_POPUP_ESCAPE_TOKEN);
    expect(sandbox).not.toContain('allow-same-origin');
    expect(sandbox.split(' ').sort()).toEqual([...OPAQUE].sort());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('/app/');
    expect(String(warn.mock.calls[0]?.[0])).toContain('https://example.com');

    resolveContentIframeSandbox('/app/', 'https://example.com');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test('keeps allow-same-origin for shell pages on the shell origin', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      resolveContentIframeSandbox('/__settings/ai', 'https://example.com').split(' ').sort(),
    ).toEqual([...WITH_ORIGIN].sort());
    expect(
      resolveContentIframeSandbox('/__cookie-preferences', 'https://example.com').split(' ').sort(),
    ).toEqual([...WITH_ORIGIN].sort());
    expect(warn).not.toHaveBeenCalled();
  });

  test('does not treat a shell-path prefix on another origin as a shell page', () => {
    const sandbox = resolveContentIframeSandbox(
      'https://cdn.example/__settings/user',
      'https://example.com',
    );
    expect(sandbox).toContain('allow-same-origin');
  });

  test('omits allow-same-origin when the URL cannot be parsed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sandbox = resolveContentIframeSandbox('http://[', 'http://localhost:4000');
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).not.toContain('allow-same-origin');
    expect(sandbox).not.toContain(LEGACY_POPUP_ESCAPE_TOKEN);
    expect(warn).toHaveBeenCalled();
  });
});
