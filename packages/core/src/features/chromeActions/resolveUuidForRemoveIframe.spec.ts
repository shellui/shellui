import { describe, expect, it, vi } from 'vitest';
import { resolveUuidFromRemoveTarget } from './ChromeActionsProvider';

describe('resolveUuidFromRemoveTarget', () => {
  it('returns string identifiers as-is', () => {
    expect(
      resolveUuidFromRemoveTarget('frame-abc', {
        getUuidByWindow: vi.fn(),
        findUuidByElement: vi.fn(),
      }),
    ).toBe('frame-abc');
  });

  it('resolves via contentWindow when available', () => {
    const getUuidByWindow = vi.fn().mockReturnValue('from-window');
    const findUuidByElement = vi.fn();
    const fakeWin = {} as Window;
    expect(
      resolveUuidFromRemoveTarget(
        { contentWindow: fakeWin },
        { getUuidByWindow, findUuidByElement },
      ),
    ).toBe('from-window');
    expect(getUuidByWindow).toHaveBeenCalledWith(fakeWin);
    expect(findUuidByElement).not.toHaveBeenCalled();
  });

  it('falls back to element match when contentWindow is null', () => {
    const getUuidByWindow = vi.fn();
    const el = { contentWindow: null };
    const findUuidByElement = vi.fn().mockReturnValue('detached-uuid');
    expect(resolveUuidFromRemoveTarget(el, { getUuidByWindow, findUuidByElement })).toBe(
      'detached-uuid',
    );
    expect(getUuidByWindow).not.toHaveBeenCalled();
    expect(findUuidByElement).toHaveBeenCalledWith(el);
  });

  it('falls back when window lookup misses', () => {
    const getUuidByWindow = vi.fn().mockReturnValue(undefined);
    const findUuidByElement = vi.fn().mockReturnValue('by-element');
    const fakeWin = {} as Window;
    const el = { contentWindow: fakeWin };
    expect(resolveUuidFromRemoveTarget(el, { getUuidByWindow, findUuidByElement })).toBe(
      'by-element',
    );
    expect(findUuidByElement).toHaveBeenCalledWith(el);
  });
});
