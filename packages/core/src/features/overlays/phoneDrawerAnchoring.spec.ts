import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DrawerPosition, OverlayOpenOptions } from '@shellui/sdk';
import {
  resolveDismissOptions,
  resolveDrawerChrome,
  resolveDrawerSizeForViewport,
} from './overlaySize';

/**
 * Phones (below 768px): every drawer must be a bottom sheet, anchored 8px plus the
 * safe area above the bottom edge, with a drag handle, sized to its content so the
 * actions sit right above the bottom where the thumb reaches. A tall sheet stops 8px
 * below the notch and scrolls inside. These tests fail if any drawer path stops being
 * bottom-anchored or content-sized on a phone.
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

/** Content heights the iframe may report: short, mid, and taller than any phone. */
const REPORTS = [120, 326, 560, 2000];

/** --shellui-drawer-bottom on a phone: 8px gap plus the bottom safe area. */
const phoneBottomOffset = (safeBottom: number) => 8 + safeBottom;
/** --shellui-drawer-top on a phone: 8px gap plus the top safe area (below the notch). */
const phoneTopOffset = (safeTop: number) => 8 + safeTop;

function specDir(): string {
  const url = import.meta.url;
  if (url.startsWith('file:')) return dirname(fileURLToPath(url));
  return dirname(url);
}

describe('phone drawers are bottom-anchored sheets', () => {
  for (const position of POSITIONS) {
    for (const { name, options } of OPTION_CASES) {
      it(`${position} drawer (${name}) is a content-sized bottom sheet with a drag handle`, () => {
        const size = resolveDrawerSizeForViewport(options, position, true);
        const chrome = resolveDrawerChrome({
          position,
          isMobile: true,
          dismiss: resolveDismissOptions(options),
          contentSized: size.contentSized,
        });
        expect(chrome.direction).toBe('bottom');
        expect(chrome.showDragHandle).toBe(true);
        // No half-height stop: the sheet is as tall as its content.
        expect(chrome.allowSnapPoints).toBe(false);
        expect(size.contentSized).toBe(true);
        expect(size.drawerSize).toBeNull();
        expect(size.style.height).toBe('auto');
        expect(size.style.maxHeight).toBe('var(--shellui-drawer-max-height)');
        // Nothing may move the sheet off its bottom anchor through inline style.
        expect(size.style.top).toBeUndefined();
        expect(size.style.bottom).toBeUndefined();
        expect(size.style.transform).toBeUndefined();
        // Apps that never report fall back to their requested height, still capped.
        if (size.fallbackHeight) {
          expect(size.fallbackHeight).toMatch(/var\(--shellui-drawer-max-height\)\)$/);
          expect(size.fallbackHeight).not.toMatch(/vw/);
        }
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
      expect(resolveDrawerSizeForViewport({ size: 'md' }, position, false).contentSized).toBe(
        false,
      );
    }
  });

  it('hides the handle while a phone sheet waits for its size', () => {
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
    for (const reported of REPORTS) {
      it(`${phone.name}: a ${reported}px sheet ends above the bottom edge, top below the notch`, () => {
        const H = phone.height;
        const bottomOffset = phoneBottomOffset(phone.safeBottom);
        // --shellui-drawer-max-height: app height minus drawer top and bottom offsets
        const maxH = H - phoneTopOffset(phone.safeTop) - bottomOffset;
        const visible = Math.min(reported, maxH);
        const bottom = H - bottomOffset;
        const top = bottom - visible;

        expect(bottom).toBe(H - 8 - phone.safeBottom);
        expect(top).toBeGreaterThanOrEqual(phone.safeTop + 8);
        // Short content: the sheet hugs it, so the actions are near the bottom.
        if (reported < maxH) expect(visible).toBe(reported);
        // Tall content: capped, the iframe scrolls inside.
        else expect(top).toBe(phone.safeTop + 8);
      });
    }
  }

  it('anchors the bottom drawer chrome to the bottom offset', () => {
    const drawerSrc = readFileSync(resolve(specDir(), '../../components/ui/drawer.tsx'), 'utf8');
    const bottom = drawerSrc.match(/^\s*bottom: `\$\{drawerPanel\}([^`]*)`/m)?.[1] ?? '';
    expect(bottom).toContain('bottom-[var(--shellui-drawer-bottom)]');
    expect(bottom).toContain('left-[var(--shellui-drawer-left)]');
    expect(bottom).toContain('right-[var(--shellui-drawer-right)]');
    expect(bottom).not.toMatch(/(^|\s)top-/);
  });

  it('keeps an 8px phone gap plus the safe areas, and caps sheets between them', () => {
    const css = readFileSync(resolve(specDir(), '../../index.css'), 'utf8');
    expect(css).toMatch(/--shellui-drawer-gap:\s*8px;/);
    expect(css).toMatch(
      /--shellui-drawer-bottom:\s*calc\(\s*var\(--shellui-drawer-gap\)\s*\+\s*var\(--shellui-safe-area-bottom\)\s*\);/,
    );
    expect(css).toMatch(
      /--shellui-drawer-top:\s*calc\(\s*var\(--shellui-drawer-gap\)\s*\+\s*var\(--shellui-safe-area-top\)\s*\);/,
    );
    expect(css).toMatch(
      /--shellui-drawer-max-height:\s*calc\(\s*var\(--shellui-app-height\)\s*-\s*var\(--shellui-drawer-top\)\s*-\s*var\(--shellui-drawer-bottom\)/,
    );
  });

  it('OverlayShell takes the drawer edge, handle and height from these helpers', () => {
    const shell = readFileSync(resolve(specDir(), '../layouts/OverlayShell.tsx'), 'utf8');
    expect(shell).toMatch(/resolveDrawerChrome\(/);
    expect(shell).toMatch(/showDragHandle=\{drawerChrome\.showDragHandle\}/);
    expect(shell).toMatch(
      /resolveDrawerSizeForViewport\(drawerOptions, drawerPosition, isMobile\)/,
    );
    // Phone sheets listen for the content size and may grow to the drawer max height.
    expect(shell).toMatch(
      /useOverlayReportedSize\(\s*drawerSize\.contentSized \|\| drawerDynamic,\s*isDrawerOpen,\s*isMobile \? 1 : undefined,?\s*\)/,
    );
    expect(shell).toMatch(/if \(!drawerChrome\.allowSnapPoints\) return undefined;/);
    // A tall content report is clamped by the drawer max height, not the overlay max
    // (which ignores the bottom offset and would push the top under the notch).
    expect(shell).toMatch(/maxHeight: `min\(\$\{drawerReported\.height\}px, \$\{DRAWER_MAX_H\}\)`/);
    expect(shell).toMatch(/height: drawerPhoneFallback, maxHeight: DRAWER_MAX_H/);
    expect(shell).toMatch(/direction=\{effectiveDrawerPosition\}/);
  });
});
