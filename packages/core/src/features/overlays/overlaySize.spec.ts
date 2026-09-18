import { describe, expect, it } from 'vitest';
import {
  DYNAMIC_DRAWER_PENDING_PX,
  DYNAMIC_OVERLAY_PENDING_PX,
  isOverlaySizePreset,
  resolveBottomSheetSnapPoints,
  resolveDialogSize,
  resolveDismissOptions,
  resolveDrawerSize,
  resolveDrawerSizeForViewport,
  resolveEffectiveDrawerPosition,
  sheetExpandedSnapFraction,
  SHEET_EXPANDED_TOP_GAP_PX,
  toCssLength,
} from './overlaySize';

describe('overlaySize', () => {
  it('exposes compact pending sizes for dynamic overlays', () => {
    expect(DYNAMIC_OVERLAY_PENDING_PX).toBeGreaterThan(0);
    expect(DYNAMIC_OVERLAY_PENDING_PX).toBeLessThan(200);
    expect(DYNAMIC_DRAWER_PENDING_PX).toBe(40);
  });

  it('recognizes size presets', () => {
    expect(isOverlaySizePreset('sm')).toBe(true);
    expect(isOverlaySizePreset('content')).toBe(true);
    expect(isOverlaySizePreset('400px')).toBe(false);
  });

  it('converts numbers to px', () => {
    expect(toCssLength(320)).toBe('320px');
    expect(toCssLength('50vh')).toBe('50vh');
  });

  it('defaults dialog to lg with horizontal gutters', () => {
    const resolved = resolveDialogSize(null);
    expect(resolved.className).toContain('max-w-4xl');
    expect(resolved.className).toContain('calc(100vw-5rem)');
    expect(resolved.contentSized).toBe(false);
  });

  it('marks content preset as contentSized', () => {
    const resolved = resolveDialogSize({ size: 'content' });
    expect(resolved.contentSized).toBe(true);
  });

  it('marks dynamicSizing as contentSized', () => {
    expect(resolveDialogSize({ dynamicSizing: true }).contentSized).toBe(true);
    expect(resolveDrawerSize({ dynamicSizing: true }, 'bottom').contentSized).toBe(true);
  });

  it('resolves drawer CSS lengths', () => {
    const resolved = resolveDrawerSize({ size: '400px' }, 'right');
    expect(resolved.drawerSize).toBe('400px');
  });

  it('resolves drawer presets by direction', () => {
    expect(resolveDrawerSize({ size: 'sm' }, 'bottom').drawerSize).toBe(
      'calc(var(--shellui-overlay-max-height) * 0.4)',
    );
    expect(resolveDrawerSize({ size: 'sm' }, 'left').drawerSize).toBe('20rem');
  });

  it('forces bottom position on mobile', () => {
    expect(resolveEffectiveDrawerPosition('right', true)).toBe('bottom');
    expect(resolveEffectiveDrawerPosition('left', true)).toBe('bottom');
    expect(resolveEffectiveDrawerPosition('top', true)).toBe('bottom');
    expect(resolveEffectiveDrawerPosition('bottom', true)).toBe('bottom');
    expect(resolveEffectiveDrawerPosition('right', false)).toBe('right');
  });

  it('remaps horizontal freeform size to default height on mobile', () => {
    const desktop = resolveDrawerSizeForViewport({ size: '60vw' }, 'right', false);
    expect(desktop.drawerSize).toBe('60vw');

    const mobile = resolveDrawerSizeForViewport({ size: '60vw' }, 'right', true);
    expect(mobile.drawerSize).toBe('calc(var(--shellui-overlay-max-height) * 0.8)');

    const preset = resolveDrawerSizeForViewport({ size: 'md' }, 'right', true);
    expect(preset.drawerSize).toBe('calc(var(--shellui-overlay-max-height) * 0.55)');

    const fromTop = resolveDrawerSizeForViewport({ size: '60vh' }, 'top', true);
    expect(fromTop.drawerSize).toBe('60vh');
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

  it('resolves bottom sheet snap points for expand / collapse', () => {
    // viewport 1000, no safe-area → expanded = 1000 - 60
    const expanded = sheetExpandedSnapFraction(1000, 0);
    expect(expanded).toBe(Number(((1000 - SHEET_EXPANDED_TOP_GAP_PX) / 1000).toFixed(4)));
    expect(resolveBottomSheetSnapPoints({ size: 'md' }, null, 1000, 0)).toEqual([0.55, expanded]);
    expect(resolveBottomSheetSnapPoints(null, null, 1000, 0)).toEqual([0.8, expanded]);
    expect(resolveBottomSheetSnapPoints({ size: '400px' }, null, 1000, 0)).toEqual([0.4, expanded]);
    expect(resolveBottomSheetSnapPoints({ size: 'full' }, null, 1000, 0)).toBeNull();
    expect(resolveBottomSheetSnapPoints({ size: 'sm' }, 700, 1000, 0)).toEqual([0.7, expanded]);
    // With notch inset, expanded shrinks further
    expect(sheetExpandedSnapFraction(1000, 47)).toBe(
      Number(((1000 - 47 - SHEET_EXPANDED_TOP_GAP_PX) / 1000).toFixed(4)),
    );
  });
});
