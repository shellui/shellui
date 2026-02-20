import { useEffect, type ComponentProps } from 'react';
import { useSettings } from '../../features/settings/hooks/useSettings';
import { Toaster as Sonner } from 'sonner';
import { Z_INDEX } from '../../lib/z-index';

type ToasterProps = ComponentProps<typeof Sonner>;

const TOAST_BUTTON_SELECTOR = '[data-close-button], [data-cancel], [data-action]';

/**
 * Ensures toast action, cancel, and close buttons respond to pointer/touch on iPad
 * and Apple Pencil by triggering click on pointerdown when the browser doesn't
 * fire a subsequent click (e.g. pen/touch).
 */
function useToastButtonPointerFix() {
  useEffect(() => {
    const onPointerDown: (e: Event) => void = (e) => {
      const ev = e as PointerEvent;
      const target = ev.target as HTMLElement;
      const button = target.closest?.(TOAST_BUTTON_SELECTOR);
      if (!button || button.getAttribute('data-disabled') === 'true') return;
      // Only programmatically click for touch/pen to avoid double-firing on mouse
      if (ev.pointerType === 'touch' || ev.pointerType === 'pen') {
        (button as HTMLButtonElement).click();
      }
    };

    function attach(toaster: Element) {
      toaster.addEventListener('pointerdown', onPointerDown, true);
      return () => toaster.removeEventListener('pointerdown', onPointerDown, true);
    }

    let toaster = document.querySelector('[data-sonner-toaster]');
    if (!toaster) {
      let cancelled = false;
      let cleanup: (() => void) | undefined;
      const id = requestAnimationFrame(() => {
        if (cancelled) return;
        toaster = document.querySelector('[data-sonner-toaster]');
        if (toaster) cleanup = attach(toaster);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(id);
        cleanup?.();
      };
    }
    return attach(toaster);
  }, []);
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { settings } = useSettings();

  useToastButtonPointerFix();

  return (
    <Sonner
      position="top-center"
      theme={settings.appearance.colorScheme as 'light' | 'dark' | 'system'}
      className="toaster group"
      style={{
        zIndex: Z_INDEX.TOAST,
        // Re-enable pointer events so toasts stay clickable when a Radix modal is open
        // (Radix sets body.style.pointerEvents = 'none' and only the dialog content gets 'auto')
        pointerEvents: 'auto',
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground [touch-action:manipulation]',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground [touch-action:manipulation]',
          closeButton: '[touch-action:manipulation]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
