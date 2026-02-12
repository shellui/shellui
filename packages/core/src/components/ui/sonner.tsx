import type { ComponentProps } from 'react';
import { useSettings } from '../../features/settings/hooks/useSettings';
import { Toaster as Sonner } from 'sonner';
import { Z_INDEX } from '../../lib/z-index';

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { settings } = useSettings();

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
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
