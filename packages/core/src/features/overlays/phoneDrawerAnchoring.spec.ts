import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DrawerPosition, OverlayOpenOptions } from '@shellui/sdk';
import {
  resolveBottomSheetSnapPoints,
  resolveDismissOptions,
  resolveDrawerChrome,
  resolveDrawerSizeForViewport,
  sheetExpandedHeightPx,
  SHEET_EXPANDED_TOP_GAP_PX,
} from './overlaySize';

/**
 * Phones (below 768px): every drawer must be a bottom sheet, anchored 8px plus the
 * safe area above the bottom edge, with a drag handle, and its content in the lower
 * part of the screen where the thumb reaches. These tests fail if any drawer path
 * stops being bottom-anchored on a phone.
 */

const POSITIONS: DrawerPosition[] = ['left', 'right', 'top', 'bottom'];

const OPTION_CASES: Array<{
  name: string;
  options: OverlayOpenOptions & { showDragHandle?: boolean };
  reported?: number;
}> = [
  { name: 'defaults', options: {} },
  { name: 'sm', options: { size: 'sm' } },
  { name: 'md', options: { size: 'md' } },
  { name: 'lg', options: { size: 'lg' } },
  { name: 'xl', options: { size: 'xl' } },
  { name: 'full', options: { size: 'full' } },
  { name: '300px', options: { size: '300px' } },
  { name: '40vh', options: { size: '40vh' } },
  { name: 'width 60vw', options: { width: '60vw' } },
  { name: 'content (reported 152px)', options: { size: 'content' }, reported: 152 },
  { name: 'dynamicSizing (reported 320px)', options: { dynamicSizing: true }, reported: 320 },
  { name: 'no drag handle', options: { showDragHandle: false } },
  { name: 'not dismissible', options: { dismissible: false } },
  {
    name: 'sm, not dismissible, no handle',
    options: { size: 'sm', dismissible: false, showDragHandle: false },
  },
];

const PHONES = [
  { name: '390 x 844 with notch', height: 844, safeTop: 47, safeBottom: 34 },
  { name: '375 x 667 without notch', height: 667, safeTop: 0, safeBottom: 0 },
  { name: '767 x 1000 (just below md)', height: 1000, safeTop: 0, safeBottom: 0 },
];

/** --shellui-drawer-bottom on a phone: 8px gap plus the bottom safe area. */
const phoneBottomOffset = (safeBottom: number) => 8 + safeBottom;

function specDir(): string {
  const url = import.meta.url;
  if (url.startsWith('file:')) return dirname(fileURLToPath(url));
  return dirname(url);
}

describe('phone drawers are bottom-anchored sheets', () => {
  for (const position of POSITIONS) {
    for (const { name, options } of OPTION_CASES) {
      it(`${position} drawer (${name}) is a bottom sheet with a drag handle`, () => {
        const contentSized = resolveDrawerSizeForViewport(options, position, true).contentSized;
        const chrome = resolveDrawerChrome({
          position,
          isMobile: true,
          dismiss: resolveDismissOptions(options),
          contentSized,
        });
        expect(chrome.direction).toBe('bottom');
        expect(chrome.showDragHandle).toBe(true);
        // Content-sized sheets sit at their content height instead of snapping.
        expect(chrome.allowSnapPoints).toBe(!contentSized);
      });
    }
  }

  it('keeps the requested edge on desktop', () => {
    for (const position of POSITIONS) {
      const chrome = resolveDrawerChrome({
        position,
        isMobile: false,
        dismiss: resolveDismissOptions({}),
      });
      expect(chrome.direction).toBe(position);
      expect(chrome.showDragHandle).toBe(position === 'top' || position === 'bottom');
    }
  });

  it('hides the handle while a dynamic drawer waits for its size', () => {
    const chrome = resolveDrawerChrome({
      position: 'right',
      isMobile: true,
      dismiss: resolveDismissOptions({}),
      pending: true,
    });
    expect(chrome.direction).toBe('bottom');
    expect(chrome.showDragHandle).toBe(false);
    expect(chrome.allowSnapPoints).toBe(false);
  });

  for (const phone of PHONES) {
    for (const position of POSITIONS) {
      for (const { name, options, reported } of OPTION_CASES) {
        it(`${phone.name}: ${position} drawer (${name}) sits above the bottom edge`, () => {
          const H = phone.height;
          const offset = phoneBottomOffset(phone.safeBottom);
          const sheetPx = sheetExpandedHeightPx(H, phone.safeTop, offset);
          const size = resolveDrawerSizeForViewport(options, position, true);
          const chrome = resolveDrawerChrome({
            position,
            isMobile: true,
            dismiss: resolveDismissOptions(options),
            contentSized: size.contentSized,
          });
          const snaps = chrome.allowSnapPoints
            ? resolveBottomSheetSnapPoints(options, reported ?? null, H, phone.safeTop, offset)
            : null;

          // Nothing may move the sheet off its bottom anchor through inline style.
          expect(size.style.top).toBeUndefined();
          expect(size.style.bottom).toBeUndefined();
          expect(size.style.transform).toBeUndefined();

          if (!snaps) {
            // No snaps: the sheet is pinned with `bottom: offset` (8px plus the safe
            // area). Content-sized sheets keep the drawer max height so the top of a
            // tall report stays on screen.
            if (size.contentSized) {
              expect(size.style.height).toBe('auto');
              expect(String(size.style.maxHeight)).toContain('--shellui-drawer-max-height');
            }
            return;
          }

          // With snaps the sheet is the expanded height, anchored at the bottom offset;
          // Vaul moves it down by H - snap * H for the first snap.
          expect(size.contentSized).toBe(false);
          const elementHeight = size.style.height === 'auto' ? (reported ?? 0) : sheetPx;
          const anchoredBottom = H - offset;
          const translate = H - snaps[0] * H;
          const firstSnapTop = anchoredBottom - elementHeight + translate;
          const expandedTop = anchoredBottom - elementHeight;

          // First snap is on screen, in the lower part, below the tappable top band.
          expect(firstSnapTop).toBeGreaterThanOrEqual(
            phone.safeTop + SHEET_EXPANDED_TOP_GAP_PX - 1,
          );
          expect(firstSnapTop).toBeLessThan(anchoredBottom - 40);
          // The visible content ends at the floating gap, above the home indicator.
          const visible = snaps[0] * H - (H - sheetPx);
          expect(Math.round(firstSnapTop + visible)).toBe(Math.round(anchoredBottom));
          // Expanded: whole sheet shows, 60px plus safe top from the top edge.
          expect(Math.round(expandedTop)).toBe(phone.safeTop + SHEET_EXPANDED_TOP_GAP_PX);
          expect(snaps[1]).toBe(1);
        });
      }
    }
  }

  it('never snaps a content-sized phone drawer (its report would push it below the screen)', () => {
    for (const options of [{ size: 'content' as const }, { dynamicSizing: true }]) {
      const chrome = resolveDrawerChrome({
        position: 'top',
        isMobile: true,
        dismiss: resolveDismissOptions(options),
        contentSized: resolveDrawerSizeForViewport(options, 'top', true).contentSized,
      });
      expect(chrome.allowSnapPoints).toBe(false);
      expect(chrome.showDragHandle).toBe(true);
    }
  });

  it('anchors the bottom drawer chrome to the bottom offset', () => {
    const drawerSrc = readFileSync(resolve(specDir(), '../../components/ui/drawer.tsx'), 'utf8');
    const bottom = drawerSrc.match(/^\s*bottom: `\$\{drawerPanel\}([^`]*)`/m)?.[1] ?? '';
    expect(bottom).toContain('bottom-[var(--shellui-drawer-bottom)]');
    expect(bottom).toContain('left-[var(--shellui-drawer-left)]');
    expect(bottom).toContain('right-[var(--shellui-drawer-right)]');
    expect(bottom).not.toMatch(/(^|\s)top-/);
  });

  it('keeps an 8px phone gap plus the bottom safe area', () => {
    const css = readFileSync(resolve(specDir(), '../../index.css'), 'utf8');
    expect(css).toMatch(/--shellui-drawer-gap:\s*8px;/);
    expect(css).toMatch(
      /--shellui-drawer-bottom:\s*calc\(\s*var\(--shellui-drawer-gap\)\s*\+\s*var\(--shellui-safe-area-bottom\)\s*\);/,
    );
  });

  it('OverlayShell takes the drawer edge, handle and snap height from these helpers', () => {
    const shell = readFileSync(resolve(specDir(), '../layouts/OverlayShell.tsx'), 'utf8');
    expect(shell).toMatch(/resolveDrawerChrome\(/);
    expect(shell).toMatch(/showDragHandle=\{drawerChrome\.showDragHandle\}/);
    expect(shell).toMatch(/contentSized: drawerSize\.contentSized \|\| drawerDynamic/);
    expect(shell).toMatch(/if \(!drawerChrome\.allowSnapPoints\) return undefined;/);
    // A tall content report is clamped by the drawer max height, not the overlay max
    // (which ignores the bottom offset and would push the top under the notch).
    expect(shell).toMatch(/maxHeight: `min\(\$\{drawerReported\.height\}px, \$\{DRAWER_MAX_H\}\)`/);
    expect(shell).toMatch(/direction=\{effectiveDrawerPosition\}/);
  });
});
