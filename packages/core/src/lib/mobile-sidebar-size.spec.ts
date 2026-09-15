import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MOBILE_SIDEBAR_SIZE,
  MOBILE_SIDEBAR_SIZE_FRACTIONS,
  clampMobileSidebarDragHeight,
  isMobileSidebarSize,
  normalizeMobileSidebarSize,
  resolveMobileSidebarHeightCss,
  resolveMobileSidebarHeightPx,
  snapMobileSidebarHeight,
} from './mobile-sidebar-size';

describe('mobileSidebarSize', () => {
  it('defaults to md', () => {
    expect(DEFAULT_MOBILE_SIDEBAR_SIZE).toBe('md');
    expect(normalizeMobileSidebarSize(undefined)).toBe('md');
    expect(normalizeMobileSidebarSize('nope')).toBe('md');
  });

  it('recognizes sm/md/lg only', () => {
    expect(isMobileSidebarSize('sm')).toBe(true);
    expect(isMobileSidebarSize('md')).toBe(true);
    expect(isMobileSidebarSize('lg')).toBe(true);
    expect(isMobileSidebarSize('xl')).toBe(false);
    expect(isMobileSidebarSize('full')).toBe(false);
  });

  it('resolves CSS heights from overlay max-height fractions', () => {
    expect(resolveMobileSidebarHeightCss('sm')).toBe(
      `calc(var(--shellui-overlay-max-height) * ${MOBILE_SIDEBAR_SIZE_FRACTIONS.sm})`,
    );
    expect(resolveMobileSidebarHeightCss('md')).toBe(
      `calc(var(--shellui-overlay-max-height) * ${MOBILE_SIDEBAR_SIZE_FRACTIONS.md})`,
    );
    expect(resolveMobileSidebarHeightCss('lg')).toBe(
      `calc(var(--shellui-overlay-max-height) * ${MOBILE_SIDEBAR_SIZE_FRACTIONS.lg})`,
    );
  });

  it('snaps to nearest size', () => {
    const max = 1000;
    expect(snapMobileSidebarHeight(resolveMobileSidebarHeightPx('sm', max), max)).toBe('sm');
    expect(snapMobileSidebarHeight(resolveMobileSidebarHeightPx('md', max), max)).toBe('md');
    expect(snapMobileSidebarHeight(resolveMobileSidebarHeightPx('lg', max), max)).toBe('lg');

    // Midway sm→md prefers the closer preset
    const sm = resolveMobileSidebarHeightPx('sm', max);
    const md = resolveMobileSidebarHeightPx('md', max);
    const mid = Math.round((sm + md) / 2);
    expect(['sm', 'md']).toContain(snapMobileSidebarHeight(mid, max));
  });

  it('closes when dragged far enough below sm', () => {
    const max = 1000;
    const sm = resolveMobileSidebarHeightPx('sm', max);
    expect(snapMobileSidebarHeight(sm * 0.4, max)).toBe('close');
    expect(snapMobileSidebarHeight(0, max)).toBe('close');
    // Just under sm but above close band still snaps to sm
    expect(snapMobileSidebarHeight(sm - 10, max)).toBe('sm');
  });

  it('clamps live drag height between dismiss band and lg', () => {
    const max = 1000;
    const lg = resolveMobileSidebarHeightPx('lg', max);
    expect(clampMobileSidebarDragHeight(10_000, max)).toBe(lg);
    expect(clampMobileSidebarDragHeight(1, max)).toBe(Math.round(max * 0.08));
    expect(clampMobileSidebarDragHeight(500, max)).toBe(500);
  });
});
