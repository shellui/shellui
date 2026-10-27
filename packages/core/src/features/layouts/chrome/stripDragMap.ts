const INTERACTIVE =
  'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="combobox"], [tabindex]:not([tabindex="-1"])';

/**
 * Controls in a macOS strip that would turn into window drag or zoom targets:
 * interactive elements without `data-shellui-no-drag` on themselves or on an
 * ancestor inside the strip, or carrying a drag attribute themselves.
 */
export function findStripDragLeaks(strip: Element): Element[] {
  const leaks: Element[] = [];
  for (const el of Array.from(strip.querySelectorAll(INTERACTIVE))) {
    if (el.hasAttribute('data-tauri-drag-region') || el.hasAttribute('data-shellui-drag-region')) {
      leaks.push(el);
      continue;
    }
    let node: Element | null = el;
    let guarded = false;
    while (node && node !== strip.parentElement) {
      if (node.hasAttribute('data-shellui-no-drag')) {
        guarded = true;
        break;
      }
      node = node.parentElement;
    }
    if (!guarded) leaks.push(el);
  }
  return leaks;
}

/** Interactive elements placed inside the drag-only lights safe area. */
export function findSafeAreaControls(strip: Element): Element[] {
  return Array.from(strip.querySelectorAll('[data-shellui-mac-safe]')).flatMap((safe) =>
    Array.from(safe.querySelectorAll(INTERACTIVE)),
  );
}
