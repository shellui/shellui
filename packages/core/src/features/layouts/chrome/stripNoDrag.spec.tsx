// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarProvider } from '../../../components/ui/sidebar';
import { CollapsedDesktopTitlebar } from './CollapsedDesktopTitlebar';
import { DesktopHistoryButtons } from './DesktopHistoryButtons';
import { MAC_DRAG_REGION_PROPS, MacLightsSafeArea, MacStripSpacer } from './MacStrip';
import { findSafeAreaControls, findStripDragLeaks } from './stripDragMap';

vi.mock('./runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./runtime')>();
  return {
    ...actual,
    useMacOverlayChrome: () => true,
    useMacTrafficLights: () => true,
    useIsTauriClient: () => true,
    useIsTauriRuntime: () => true,
  };
});
vi.mock('../../modal/ModalContext', () => ({ useModal: () => ({ isOpen: false }) }));
vi.mock('../../drawer/DrawerContext', () => ({ useDrawer: () => ({ isOpen: false }) }));
vi.mock('../../storage/StoragePickerContext', () => ({
  useStoragePicker: () => ({ isOpen: false }),
}));

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

function getStrip(): Element {
  const strip = container.querySelector('[data-shellui-mac-strip]');
  if (!strip) throw new Error('strip not rendered');
  return strip;
}

function render(node: React.ReactNode) {
  act(() => {
    root.render(<MemoryRouter>{node}</MemoryRouter>);
  });
}

describe('macOS strip drag map', () => {
  it('collapsed sidebar strip: every control is no-drag, the safe area holds none', () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <CollapsedDesktopTitlebar />
      </SidebarProvider>,
    );
    const strip = getStrip();
    expect(strip.hasAttribute('data-tauri-drag-region')).toBe(true);
    // Expand trigger, Back, Forward.
    expect(strip.querySelectorAll('button').length).toBe(3);
    expect(findStripDragLeaks(strip)).toEqual([]);
    expect(findSafeAreaControls(strip)).toEqual([]);
    const safe = strip.firstElementChild;
    if (!safe) throw new Error('safe area missing');
    expect(safe.hasAttribute('data-shellui-mac-safe')).toBe(true);
    expect(safe.hasAttribute('data-tauri-drag-region')).toBe(true);
  });

  it('history buttons in a strip carry no-drag', () => {
    render(
      <div
        data-shellui-mac-strip=""
        {...MAC_DRAG_REGION_PROPS}
      >
        <MacLightsSafeArea />
        <DesktopHistoryButtons strip />
        <MacStripSpacer />
      </div>,
    );
    const strip = getStrip();
    expect(strip.querySelectorAll('button').length).toBe(2);
    expect(findStripDragLeaks(strip)).toEqual([]);
  });

  it('flags a control without no-drag, one marked as drag, and one in the safe area', () => {
    container.innerHTML = `
      <div data-shellui-mac-strip data-tauri-drag-region>
        <div data-shellui-mac-safe data-tauri-drag-region><button id="in-safe" data-shellui-no-drag></button></div>
        <button id="bare"></button>
        <a id="drag-link" href="/x" data-shellui-no-drag data-tauri-drag-region></a>
        <div data-shellui-no-drag><button id="ok"></button></div>
      </div>`;
    const strip = getStrip();
    expect(findStripDragLeaks(strip).map((el) => el.id)).toEqual(['bare', 'drag-link']);
    expect(findSafeAreaControls(strip).map((el) => el.id)).toEqual(['in-safe']);
  });
});
