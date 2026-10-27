// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../i18n/translations/en/common.json';
import fr from '../../../i18n/translations/fr/common.json';
import { SidebarProvider } from '../../../components/ui/sidebar';
import { getAccountInitials, LoginButton } from './LoginButton';

type User = { name?: string; email?: string; profilePicture?: string };
const auth: { isAuthenticated: boolean; isLoading: boolean; user: User | null } = {
  isAuthenticated: true,
  isLoading: false,
  user: null,
};

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ ...auth, logout: vi.fn() }),
}));
vi.mock('../../config/useConfig', () => ({
  useConfig: () => ({ config: { backend: { type: 'shellui' } } }),
}));
vi.mock('../../../hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      const [group, leaf] = key.split('.') as [keyof typeof en, string];
      const raw = (en[group] as Record<string, string>)[leaf] ?? opts?.defaultValue ?? key;
      return raw.replace(/\{\{(\w+)\}\}/g, (_, k: string) => opts?.[k] ?? '');
    },
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  auth.isAuthenticated = true;
  auth.isLoading = false;
  auth.user = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(open = true, dividerAbove = false) {
  act(() => {
    root.render(
      <MemoryRouter>
        <SidebarProvider defaultOpen={open}>
          <LoginButton
            variant="sidebar"
            dividerAbove={dividerAbove}
          />
        </SidebarProvider>
      </MemoryRouter>,
    );
  });
  return container.querySelector<HTMLButtonElement>('[data-shellui-account-trigger]');
}

describe('getAccountInitials', () => {
  it('uses the first and last word of the name', () => {
    expect(getAccountInitials('Alex Martin', 'alex@acme.dev')).toBe('AM');
    expect(getAccountInitials('  jean  claude van damme ', null)).toBe('JD');
    expect(getAccountInitials('Émile', null)).toBe('É');
  });

  it('falls back to the email', () => {
    expect(getAccountInitials('', 'zoe@acme.dev')).toBe('Z');
    expect(getAccountInitials(null, null)).toBe('');
  });
});

describe('sidebar account block', () => {
  it('shows initials, name, email and the chevrons-up-down icon', () => {
    auth.user = { name: 'Alex Martin', email: 'alex@acme.dev' };
    const btn = render();
    expect(btn).not.toBeNull();
    expect(btn?.querySelector('[data-shellui-account-initials]')?.textContent).toBe('AM');
    expect(btn?.textContent).toContain('Alex Martin');
    expect(btn?.querySelector('[data-shellui-account-email]')?.textContent).toBe('alex@acme.dev');
    expect(btn?.querySelectorAll('svg path')).toHaveLength(2);
    expect(btn?.getAttribute('aria-label')).toBe(
      'Open account menu for Alex Martin, alex@acme.dev',
    );
    expect(btn?.hasAttribute('data-shellui-no-drag')).toBe(true);
  });

  it('truncates long names and emails', () => {
    auth.user = {
      name: 'Maximilian Alexander von Hohenberg-Wittelsbach',
      email: 'maximilian.alexander.von.hohenberg@very-long-company-domain.example',
    };
    const btn = render();
    const email = btn?.querySelector('[data-shellui-account-email]');
    expect(email?.className).toContain('truncate');
    expect(email?.previousElementSibling?.className).toContain('truncate');
    expect(email?.parentElement?.className).toContain('min-w-0');
  });

  it('shows the email as the name, once, when there is no name', () => {
    auth.user = { email: 'zoe@acme.dev' };
    const btn = render();
    expect(btn?.querySelector('[data-shellui-account-email]')).toBeNull();
    expect(btn?.querySelector('[data-shellui-account-initials]')?.textContent).toBe('Z');
    expect(btn?.getAttribute('aria-label')).toBe('Open account menu for zoe@acme.dev');
  });

  it('shows the profile picture instead of initials', () => {
    auth.user = {
      name: 'Alex Martin',
      email: 'alex@acme.dev',
      profilePicture: 'https://x.test/a.png',
    };
    const btn = render();
    expect(btn?.querySelector('img')?.getAttribute('src')).toBe('https://x.test/a.png');
    expect(btn?.querySelector('[data-shellui-account-initials]')).toBeNull();
  });

  it('collapsed icon mode hides the text and keeps the avatar', () => {
    auth.user = { name: 'Alex Martin', email: 'alex@acme.dev' };
    const btn = render(false);
    expect(btn?.querySelector('[data-shellui-account-initials]')).not.toBeNull();
    expect(btn?.querySelector('[data-shellui-account-email]')?.parentElement?.className).toContain(
      'group-data-[collapsible=icon]:hidden',
    );
    expect(btn?.querySelector('svg')?.getAttribute('class')).toContain(
      'group-data-[collapsible=icon]:hidden',
    );
  });

  it('renders a two line skeleton while loading', () => {
    auth.isLoading = true;
    render();
    const status = container.querySelector('[data-shellui-auth-loading]');
    expect(status?.getAttribute('aria-label')).toBe(en.authMenu.loadingAccount);
    expect(status?.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length).toBe(3);
  });
});

describe('account aria strings', () => {
  it('exist in en and fr', () => {
    for (const key of ['openAccountMenuAriaLabel', 'openAccountMenuWithEmailAriaLabel'] as const) {
      expect(en.authMenu[key]).toContain('{{name}}');
      expect(fr.authMenu[key]).toContain('{{name}}');
    }
    expect(fr.authMenu.openAccountMenuWithEmailAriaLabel).toContain('{{email}}');
  });
});

describe('account divider', () => {
  const divider = () => container.querySelector<HTMLElement>('[data-shellui-account-divider]');

  it('draws a sidebar border hairline above the signed-in account block', () => {
    auth.user = { name: 'Alex Martin', email: 'alex@acme.dev' };
    const btn = render(true, true);
    const line = divider();
    expect(line).not.toBeNull();
    expect(line?.getAttribute('role')).toBe('separator');
    expect(line?.className).toContain('bg-sidebar-border');
    expect(line?.className).toContain('h-px');
    expect(line?.nextElementSibling).toBe(btn);
  });

  it('stays in collapsed icon mode', () => {
    auth.user = { name: 'Alex Martin', email: 'alex@acme.dev' };
    render(false, true);
    expect(divider()).not.toBeNull();
  });

  it('is off unless asked for', () => {
    auth.user = { name: 'Alex Martin', email: 'alex@acme.dev' };
    render(true, false);
    expect(divider()).toBeNull();
  });

  it('never shows for the signed-out login button', () => {
    auth.isAuthenticated = false;
    render(true, true);
    expect(container.querySelector('a')?.textContent).toContain(en.authMenu.login);
    expect(divider()).toBeNull();
  });

  it('never shows while loading', () => {
    auth.isLoading = true;
    render(true, true);
    expect(divider()).toBeNull();
  });
});
