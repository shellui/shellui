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
    const onPointerDown = (e: Event) => {
      const ev = e as PointerEvent;
      // Only trigger programmatic click for touch/pen (iPad etc.); mouse gets native click.
      if (ev.pointerType !== 'touch' && ev.pointerType !== 'pen') return;
      // When a modal is open (e.g. Radix), body has pointer-events: none so the toaster
      // may never receive the event on iPad. Use document capture + elementFromPoint so we
      // still detect touches over the toaster and trigger the button.
      const toaster = document.querySelector('[data-sonner-toaster]');
      if (!toaster) return;
      const elementUnderPoint = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!elementUnderPoint?.isConnected) return;
      const button = (elementUnderPoint as HTMLElement).closest?.(TOAST_BUTTON_SELECTOR);
      if (!button || !toaster.contains(button) || button.getAttribute('data-disabled') === 'true')
        return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: ev.view ?? window,
        detail: 1,
        clientX: ev.clientX,
        clientY: ev.clientY,
        screenX: ev.screenX,
        screenY: ev.screenY,
      });
      button.dispatchEvent(clickEvent);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
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
