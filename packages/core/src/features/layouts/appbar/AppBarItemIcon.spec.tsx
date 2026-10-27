// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NavigationItem } from '../../config/types';
import { AppBarItemIcon } from './AppBarItemIcon';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(item: Partial<NavigationItem>) {
  act(() =>
    root.render(<AppBarItemIcon item={{ path: 'x', url: '/x', label: 'Docs', ...item }} />),
  );
  return container.firstElementChild as HTMLElement;
}

describe('AppBarItemIcon', () => {
  it('renders a plain 16px icon with no muted tile', () => {
    const el = render({ icon: '/icons/book.svg' });
    expect(el.className).toContain('size-4');
    expect(el.className).not.toContain('bg-muted');
    expect(el.className).not.toContain('rounded-md');
  });

  it('falls back to the default 16px glyph instead of a letter tile', () => {
    const el = render({});
    expect(el.tagName.toLowerCase()).toBe('svg');
    expect(el.getAttribute('class')).toContain('size-4');
    expect(container.textContent).toBe('');
  });
});
