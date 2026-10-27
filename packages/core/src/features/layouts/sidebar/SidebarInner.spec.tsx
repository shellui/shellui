// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../i18n/translations/en/common.json';
import fr from '../../../i18n/translations/fr/common.json';
import { SIDEBAR_PANEL_ID, SidebarProvider, SidebarTrigger } from '../../../components/ui/sidebar';
import { SidebarInner } from './SidebarInner';

const mobile = { value: false };

vi.mock('../../../hooks/use-mobile', () => ({ useIsMobile: () => mobile.value }));
vi.mock('../chrome/runtime', () => ({
  useIsTauriClient: () => false,
  useMacOverlayChrome: () => false,
  useMacTrafficLights: () => false,
}));
vi.mock('./NavigationContent', () => ({
  NavigationContent: ({ trailing }: { trailing?: ReactNode }) => trailing ?? null,
}));
vi.mock('../../config/useConfig', () => ({ useConfig: () => ({ config: {} }) }));
vi.mock('../../auth/components/LoginButton', () => ({
  LoginButton: ({ dividerAbove }: { dividerAbove?: boolean }) => (
    <span
      data-login=""
      data-divider={String(Boolean(dividerAbove))}
    />
  ),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const [group, leaf] = key.split('.') as [keyof typeof en, string];
      return (en[group] as Record<string, string>)[leaf] ?? key;
    },
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mobile.value = false;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(node: React.ReactNode, open = true) {
  act(() => {
    root.render(
      <MemoryRouter>
        <SidebarProvider defaultOpen={open}>{node}</SidebarProvider>
      </MemoryRouter>,
    );
  });
}

function q<T extends Element = HTMLElement>(scope: ParentNode, sel: string): T {
  const el = scope.querySelector<T>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
}

const inner = (
  <SidebarInner
    startNav={[]}
    endItems={[]}
    showAuthButton={false}
    title="Acme"
    appIcon="/icon.svg"
  />
);

describe('SidebarTrigger', () => {
  it('reports aria-expanded and aria-controls', () => {
    render(<SidebarTrigger />);
    const btn = q<HTMLButtonElement>(container, 'button');
    expect(btn.getAttribute('aria-controls')).toBe(SIDEBAR_PANEL_ID);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    act(() => btn.click());
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('SidebarInner header', () => {
  it('shows the app name next to the logo, with no border under the header', () => {
    render(inner);
    const header = q(container, '[data-sidebar="header"]');
    expect(header.textContent).toContain('Acme');
    expect(header.className).not.toContain('border-b');
    expect(q(header, 'span.truncate').className).toContain(
      'group-data-[collapsible=icon]:opacity-0',
    );
  });

  it('mobile sheet header is 52px with a labelled close button', () => {
    mobile.value = true;
    render(inner);
    const header = q(container, '[data-sidebar="header"]');
    expect(header.style.height).toBe('52px');
    const close = q(header, 'button');
    expect(close.getAttribute('aria-label')).toBe('Close menu');
    expect(header.textContent).toContain('Acme');
  });

  it('has the close label in French', () => {
    expect(fr.shellChrome.closeMenu).toBe('Fermer le menu');
  });
});

describe('SidebarInner footer account divider', () => {
  const footer = (endItems: { label: string; path: string; url: string }[]) => (
    <SidebarInner
      startNav={[]}
      endItems={endItems}
      showAuthButton
      title="Acme"
    />
  );

  it('asks for a divider when footer items sit above the account block', () => {
    render(footer([{ label: 'Settings', path: 'settings', url: '/settings' }]));
    expect(q(container, '[data-login]').getAttribute('data-divider')).toBe('true');
  });

  it('opens the footer with the shared full-width divider instead of a border', () => {
    render(footer([]));
    const foot = q(container, '[data-shellui-nav-footer]');
    expect(foot.className).not.toContain('border-t');
    const first = foot.firstElementChild;
    expect(first?.getAttribute('data-shellui-divider')).toBe('');
    expect(first?.className).toContain('shellui-divider');
    expect(first?.hasAttribute('data-shellui-footer-divider')).toBe(true);
  });

  it('skips the account divider when the account block is the only footer item', () => {
    render(footer([]));
    expect(q(container, '[data-login]').getAttribute('data-divider')).toBe('false');
  });
});
