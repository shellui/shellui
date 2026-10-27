// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { DESK_DOTS, bucketAlpha, gridSize, isAccentDot } from './deskDots';
import { isDesktopCovered } from './DesktopDots';

describe('DESK_DOTS', () => {
  it('keeps the calm parameters from the spec', () => {
    expect(DESK_DOTS.fps).toBe(30);
    expect(DESK_DOTS.dprMax).toBe(2);
    expect(DESK_DOTS.gustPx).toBe(3.5);
    expect(DESK_DOTS.crossMs).toEqual([30000, 40000]);
    expect(DESK_DOTS.everyMs).toEqual([9000, 15000]);
  });
});

describe('bucketAlpha', () => {
  it('starts near the base alpha and rises with the gust', () => {
    expect(bucketAlpha(false, 0, false)).toBeCloseTo(0.15 + 0.16 / 12, 5);
    expect(bucketAlpha(false, 0, true)).toBeCloseTo(0.11 + 0.16 / 12, 5);
    expect(bucketAlpha(false, 5, false)).toBeGreaterThan(bucketAlpha(false, 0, false));
    expect(bucketAlpha(true, 0, false)).toBeGreaterThan(bucketAlpha(false, 0, false));
  });
});

describe('gridSize', () => {
  it('covers the host with a 24 px grid', () => {
    expect(gridSize(1440, 900)).toEqual({ cols: 60, rows: 38, count: 2280 });
    expect(gridSize(0, 900).count).toBe(0);
  });
});

describe('isAccentDot', () => {
  it('tints about one dot in eleven', () => {
    let accents = 0;
    for (let r = 0; r < 22; r++) for (let c = 0; c < 22; c++) if (isAccentDot(c, r)) accents++;
    expect(accents / (22 * 22)).toBeCloseTo(1 / 11, 1);
  });
});

describe('isDesktopCovered', () => {
  it('pauses for a focused maximized window or a drag, not for a background maximized one', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div data-shellui-window data-focused="false" data-maximized="true"></div><div data-shellui-window data-focused="true" data-maximized="false"></div>';
    expect(isDesktopCovered(root)).toBe(false);
    root.lastElementChild?.setAttribute('data-interacting', 'true');
    expect(isDesktopCovered(root)).toBe(true);
    root.lastElementChild?.removeAttribute('data-interacting');
    root.firstElementChild?.setAttribute('data-focused', 'true');
    expect(isDesktopCovered(root)).toBe(true);
  });
});
