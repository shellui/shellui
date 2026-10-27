// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator } from './dropdown-menu';
import { ShellDivider } from './shell-divider';

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

const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');

describe('ShellDivider', () => {
  it('renders the shared divider as a separator', () => {
    act(() => root.render(<ShellDivider className="-mx-2" />));
    const el = container.firstElementChild;
    expect(el?.getAttribute('role')).toBe('separator');
    expect(el?.className).toBe('shellui-divider -mx-2');
  });

  it('is a full-width hairline with no margin of its own (kit shell.css)', () => {
    const rule = /\.shellui-divider \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('height: 1px');
    expect(rule).toContain('background: var(--shellui-hairline)');
    expect(rule).not.toContain('margin');
  });

  it('is hidden in the sidebar inset footer (sidebar-inset spec: no footer hairline)', () => {
    expect(css).toMatch(
      /\[data-shellui-layout-variant='inset'\]\s+\.shellui-nav\[data-shellui-nav-footer\]\s+>\s+\[data-shellui-footer-divider\]\s*\{\s*background: transparent;/,
    );
  });

  it('menus keep the full-bleed shadcn separator (kit .menu hr)', () => {
    act(() =>
      root.render(
        <DropdownMenu open>
          <DropdownMenuContent>
            <DropdownMenuSeparator />
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    );
    const sep = document.body.querySelector('[role="separator"]');
    expect(sep?.className).toContain('-mx-1');
    expect(sep?.className).toContain('bg-border');
  });
});
