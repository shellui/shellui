import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  applyLayoutChromeStyles,
  LAYOUT_CHROME_ANIMATE_ATTR,
  LAYOUT_CHROME_PAD_CLASS,
} from './layoutChrome.js';
import type { LayoutChrome } from './types.js';

const sampleChrome: LayoutChrome = {
  layout: 'floating',
  viewport: 'mobile',
  chromeVisible: true,
  autoPadding: true,
  insets: { top: 0, right: 0, bottom: 88, left: 0 },
};

function createStyleTarget() {
  const props = new Map<string, string>();
  const classes = new Set<string>();
  const attrs = new Set<string>();
  return {
    style: {
      setProperty: (name: string, value: string) => {
        props.set(name, value);
      },
      getPropertyValue: (name: string) => props.get(name) ?? '',
    },
    classList: {
      add: (name: string) => {
        classes.add(name);
      },
      remove: (name: string) => {
        classes.delete(name);
      },
      contains: (name: string) => classes.has(name),
    },
    setAttribute(name: string) {
      attrs.add(name);
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
    hasAttribute(name: string) {
      return attrs.has(name);
    },
    offsetHeight: 0,
  };
}

describe('applyLayoutChromeStyles', () => {
  const root = createStyleTarget();
  const body = createStyleTarget();

  beforeEach(() => {
    root.style.setProperty('--shellui-inset-top', '');
    root.style.setProperty('--shellui-inset-right', '');
    root.style.setProperty('--shellui-inset-bottom', '');
    root.style.setProperty('--shellui-inset-left', '');
    body.classList.remove(LAYOUT_CHROME_PAD_CLASS);
    for (const name of [
      'data-shellui-layout-chrome',
      'data-shellui-layout-chrome-pad',
      LAYOUT_CHROME_ANIMATE_ATTR,
    ]) {
      root.removeAttribute(name);
    }

    vi.stubGlobal('document', {
      documentElement: root,
      body,
      head: { appendChild: () => undefined },
      getElementById: () => ({ id: 'shellui-layout-chrome-pad-styles' }),
      createElement: () => ({ id: '', textContent: '' }),
    });
  });

  it('sets CSS inset variables without padding the frame', () => {
    applyLayoutChromeStyles(sampleChrome, {
      el: root as unknown as HTMLElement,
      autoPadding: false,
    });
    expect(root.style.getPropertyValue('--shellui-inset-bottom')).toBe('88px');
    expect(body.classList.contains(LAYOUT_CHROME_PAD_CLASS)).toBe(false);
    expect(root.hasAttribute('data-shellui-layout-chrome-pad')).toBe(false);
  });

  it('adds pad class on body when autoPadding is on', () => {
    applyLayoutChromeStyles(sampleChrome, {
      el: root as unknown as HTMLElement,
      autoPadding: true,
    });
    expect(body.classList.contains(LAYOUT_CHROME_PAD_CLASS)).toBe(true);
    expect(root.hasAttribute('data-shellui-layout-chrome-pad')).toBe(true);
    expect(root.style.getPropertyValue('--shellui-inset-bottom')).toBe('88px');
  });

  it('injects pad stylesheet into the app document', () => {
    const created: { id?: string; textContent?: string }[] = [];
    const head = {
      appendChild: (node: { id?: string; textContent?: string }) => {
        created.push(node);
      },
    };
    vi.stubGlobal('document', {
      documentElement: root,
      body,
      head,
      getElementById: () => null,
      createElement: (tag: string) => {
        expect(tag).toBe('style');
        return { id: '', textContent: '' };
      },
    });

    applyLayoutChromeStyles(sampleChrome, {
      el: root as unknown as HTMLElement,
      autoPadding: true,
    });

    expect(created).toHaveLength(1);
    expect(created[0]?.id).toBe('shellui-layout-chrome-pad-styles');
    expect(created[0]?.textContent).toContain(LAYOUT_CHROME_PAD_CLASS);
    expect(created[0]?.textContent).toContain('@property --shellui-inset-top');
    expect(created[0]?.textContent).toContain(LAYOUT_CHROME_ANIMATE_ATTR);
    expect(created[0]?.textContent).toContain('transition');
  });

  it('clears pad class on opt-out after prior auto pad', () => {
    applyLayoutChromeStyles(sampleChrome, {
      el: root as unknown as HTMLElement,
      autoPadding: true,
    });
    applyLayoutChromeStyles(sampleChrome, {
      el: root as unknown as HTMLElement,
      autoPadding: false,
    });
    expect(body.classList.contains(LAYOUT_CHROME_PAD_CLASS)).toBe(false);
    expect(root.hasAttribute('data-shellui-layout-chrome-pad')).toBe(false);
    expect(root.style.getPropertyValue('--shellui-inset-bottom')).toBe('88px');
  });

  it('applies auto padding for action insets even when layout is none', () => {
    const actionsOnly: LayoutChrome = {
      layout: 'none',
      viewport: 'desktop',
      chromeVisible: false,
      autoPadding: true,
      insets: { top: 48, right: 0, bottom: 56, left: 0 },
    };
    applyLayoutChromeStyles(actionsOnly, {
      el: root as unknown as HTMLElement,
      autoPadding: true,
    });
    expect(body.classList.contains(LAYOUT_CHROME_PAD_CLASS)).toBe(true);
    expect(root.hasAttribute('data-shellui-layout-chrome-pad')).toBe(true);
    expect(root.style.getPropertyValue('--shellui-inset-top')).toBe('48px');
    expect(root.hasAttribute(LAYOUT_CHROME_ANIMATE_ATTR)).toBe(false);
  });

  it('keeps pad class at zero insets so show/hide can CSS-transition', () => {
    const cleared: LayoutChrome = {
      layout: 'none',
      viewport: 'desktop',
      chromeVisible: false,
      autoPadding: true,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    applyLayoutChromeStyles(cleared, {
      el: root as unknown as HTMLElement,
      autoPadding: true,
    });
    expect(body.classList.contains(LAYOUT_CHROME_PAD_CLASS)).toBe(true);
    expect(root.hasAttribute('data-shellui-layout-chrome-pad')).toBe(true);
    expect(root.style.getPropertyValue('--shellui-inset-top')).toBe('0px');
  });

  it('enables animate attr when animate option is true', () => {
    applyLayoutChromeStyles(sampleChrome, {
      el: root as unknown as HTMLElement,
      autoPadding: true,
      animate: true,
    });
    expect(root.hasAttribute(LAYOUT_CHROME_ANIMATE_ATTR)).toBe(true);
  });
});
