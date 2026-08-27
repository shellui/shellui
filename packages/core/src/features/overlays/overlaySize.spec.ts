import { describe, expect, it } from 'vitest';
import {
  isOverlaySizePreset,
  resolveDialogSize,
  resolveDismissOptions,
  resolveDrawerSize,
  toCssLength,
} from './overlaySize';

describe('overlaySize', () => {
  it('recognizes size presets', () => {
    expect(isOverlaySizePreset('sm')).toBe(true);
    expect(isOverlaySizePreset('content')).toBe(true);
    expect(isOverlaySizePreset('400px')).toBe(false);
  });

  it('converts numbers to px', () => {
    expect(toCssLength(320)).toBe('320px');
    expect(toCssLength('50vh')).toBe('50vh');
  });

  it('defaults dialog to lg', () => {
    const resolved = resolveDialogSize(null);
    expect(resolved.className).toContain('max-w-4xl');
    expect(resolved.contentSized).toBe(false);
  });

  it('marks content preset as contentSized', () => {
    const resolved = resolveDialogSize({ size: 'content' });
    expect(resolved.contentSized).toBe(true);
  });

  it('resolves drawer CSS lengths', () => {
    const resolved = resolveDrawerSize({ size: '400px' }, 'right');
    expect(resolved.drawerSize).toBe('400px');
  });

  it('resolves drawer presets by direction', () => {
    expect(resolveDrawerSize({ size: 'sm' }, 'bottom').drawerSize).toBe('40dvh');
    expect(resolveDrawerSize({ size: 'sm' }, 'left').drawerSize).toBe('20rem');
  });

  it('defaults dismiss options', () => {
    expect(resolveDismissOptions(null)).toEqual({
      showCloseButton: true,
      dismissible: true,
      closeOnOverlayClick: true,
      showDragHandle: true,
    });
    expect(resolveDismissOptions({ showCloseButton: false, dismissible: false })).toEqual({
      showCloseButton: false,
      dismissible: false,
      closeOnOverlayClick: true,
      showDragHandle: false,
    });
  });
});
