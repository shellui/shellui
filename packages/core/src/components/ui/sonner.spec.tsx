// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Z_INDEX } from '../../lib/z-index';
import { Toaster } from './sonner';

vi.mock('../../features/settings/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: { appearance: { colorScheme: 'light' } },
  }),
}));

const POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

function specDir(): string {
  const url = import.meta.url;
  if (url.startsWith('file:')) return dirname(fileURLToPath(url));
  return dirname(url);
}

const indexCss = readFileSync(resolve(specDir(), '../../index.css'), 'utf8');

function installToasterPointerCss() {
  document.getElementById('toaster-pointer-test')?.remove();
  const toasterRule = indexCss.match(
    /\[data-sonner-toaster\]\s*\{[^}]*pointer-events:\s*none\s*!important;[^}]*\}/,
  );
  const toastRule = indexCss.match(
    /\[data-sonner-toast\],[\s\S]*?\[data-upload-toast\] button\s*\{[^}]*pointer-events:\s*auto\s*!important;[^}]*\}/,
  );
  expect(toasterRule, 'toaster list must be pointer-events: none').toBeTruthy();
  expect(toastRule, 'toast cards and buttons must be pointer-events: auto').toBeTruthy();
  const style = document.createElement('style');
  style.id = 'toaster-pointer-test';
  style.textContent = `${toasterRule?.[0] ?? ''}\n${toastRule?.[0] ?? ''}`;
  document.head.appendChild(style);
}

async function flush() {
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
}

describe('Toaster hit testing', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    installToasterPointerCss();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    toast.dismiss();
    await flush();
    await act(async () => {
      root.unmount();
    });
    host.remove();
    document.body.style.pointerEvents = '';
  });

  it('does not stretch bottom lists and keeps pointer events on the cards', async () => {
    await act(async () => {
      root.render(<Toaster closeButton />);
    });

    for (const position of POSITIONS) {
      toast(position, {
        id: position,
        duration: Infinity,
        position,
        description: 'Offset check',
        action: { label: 'Go', onClick: () => {} },
        cancel: { label: 'Stop', onClick: () => {} },
      });
    }
    await flush();
    await flush();

    const lists = [...document.querySelectorAll<HTMLElement>('[data-sonner-toaster]')];
    expect(
      lists.map((list) => `${list.dataset.yPosition}-${list.dataset.xPosition}`).sort(),
    ).toEqual([...POSITIONS].sort());

    for (const list of lists) {
      expect(list.style.top, `${list.dataset.yPosition} list inline top`).toBe('');
      expect(list.style.pointerEvents, `${list.dataset.yPosition} list inline pointer-events`).toBe(
        '',
      );
      expect(list.style.zIndex).toBe(String(Z_INDEX.TOAST));
      expect(list.style.getPropertyValue('--offset-top')).toContain('--shellui-safe-area-top');
      expect(list.style.getPropertyValue('--mobile-offset-top')).toContain(
        '--shellui-safe-area-top',
      );
      expect(getComputedStyle(list).pointerEvents).toBe('none');

      const card = list.querySelector<HTMLElement>('[data-sonner-toast]');
      if (!card) throw new Error('missing toast card');
      expect(getComputedStyle(card).pointerEvents).toBe('auto');
      for (const selector of ['[data-action]', '[data-cancel]', '[data-close-button]']) {
        const button = card.querySelector<HTMLElement>(selector);
        if (!button) throw new Error(`missing ${selector}`);
        expect(getComputedStyle(button).pointerEvents).toBe('auto');
      }
    }

    document.body.style.pointerEvents = 'none';
    const bottom = document.querySelector<HTMLElement>(
      '[data-sonner-toaster][data-y-position="bottom"][data-x-position="center"]',
    );
    if (!bottom) throw new Error('missing bottom-center list');
    expect(getComputedStyle(bottom).pointerEvents).toBe('none');
    const bottomCard = bottom.querySelector<HTMLElement>('[data-sonner-toast]');
    const action = bottomCard?.querySelector<HTMLElement>('[data-action]');
    const close = bottomCard?.querySelector<HTMLElement>('[data-close-button]');
    if (!bottomCard || !action || !close) throw new Error('missing bottom-center controls');
    expect(getComputedStyle(bottomCard).pointerEvents).toBe('auto');
    expect(getComputedStyle(action).pointerEvents).toBe('auto');
    expect(getComputedStyle(close).pointerEvents).toBe('auto');
  });
});
