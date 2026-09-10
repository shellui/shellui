import { describe, expect, it } from 'vitest';
import { resolveViewport } from '../../../hooks/use-viewport';
import { reduceScrollChromeVisibility } from '@shellui/sdk';

describe('resolveViewport', () => {
  it('maps widths to mobile / tablet / desktop', () => {
    expect(resolveViewport(320)).toBe('mobile');
    expect(resolveViewport(767)).toBe('mobile');
    expect(resolveViewport(768)).toBe('tablet');
    expect(resolveViewport(1023)).toBe('tablet');
    expect(resolveViewport(1024)).toBe('desktop');
  });
});

describe('reduceScrollChromeVisibility', () => {
  it('reveals chrome near the top', () => {
    const next = reduceScrollChromeVisibility({ visible: false, lastY: 100 }, 10);
    expect(next.visible).toBe(true);
  });

  it('hides chrome when scrolling down past threshold', () => {
    const next = reduceScrollChromeVisibility({ visible: true, lastY: 40 }, 60);
    expect(next.visible).toBe(false);
  });

  it('shows chrome when scrolling up past threshold', () => {
    const next = reduceScrollChromeVisibility({ visible: false, lastY: 80 }, 60);
    expect(next.visible).toBe(true);
  });

  it('ignores small deltas (hysteresis)', () => {
    const next = reduceScrollChromeVisibility({ visible: true, lastY: 50 }, 55);
    expect(next.visible).toBe(true);
  });

  it('reveals chrome near the bottom of the scroller', () => {
    const next = reduceScrollChromeVisibility({ visible: false, lastY: 400 }, 480, {
      distanceFromBottom: 40,
    });
    expect(next.visible).toBe(true);
  });

  it('keeps chrome hidden when still far from the bottom while scrolling down', () => {
    const next = reduceScrollChromeVisibility({ visible: true, lastY: 200 }, 260, {
      distanceFromBottom: 200,
    });
    expect(next.visible).toBe(false);
  });
});
