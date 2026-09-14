import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  clearAllChromeActions,
  clearChromeActionsForFrame,
  getChromeActionsForFrame,
  setChromeActionsForFrame,
  subscribeChromeActions,
} from './chromeActionsStore';

describe('chrome actions clear-on-shell-nav (store)', () => {
  beforeEach(() => {
    clearAllChromeActions();
  });

  it('notifies subscribers when a frame is cleared (iframe remove / shell nav)', () => {
    const listener = vi.fn();
    const stop = subscribeChromeActions(listener);
    setChromeActionsForFrame('frame-a', {
      title: 'A',
      primary: { id: 'p', icon: 'plus' },
    });
    setChromeActionsForFrame('frame-b', { title: 'B' });
    expect(listener).toHaveBeenCalled();
    listener.mockClear();

    // Simulate ContentView unmount → removeIframe → clearChromeActionsForFrame
    expect(clearChromeActionsForFrame('frame-a')).toBe(true);
    expect(getChromeActionsForFrame('frame-a')).toBeNull();
    expect(getChromeActionsForFrame('frame-b')?.title).toBe('B');
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('keeps independent action sets per contentView', () => {
    setChromeActionsForFrame('a', {
      title: 'One',
      trailing: [{ id: 't1', label: 'Edit' }],
    });
    setChromeActionsForFrame('b', {
      title: 'Two',
      primary: { id: 'fab', icon: 'plus' },
    });
    expect(getChromeActionsForFrame('a')?.trailing?.[0]?.id).toBe('t1');
    expect(getChromeActionsForFrame('a')?.primary).toBeUndefined();
    expect(getChromeActionsForFrame('b')?.primary?.id).toBe('fab');
    expect(getChromeActionsForFrame('b')?.trailing).toBeUndefined();
  });
});
