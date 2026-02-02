import type { ReactNode } from 'react';
import { ModalProvider } from '../modal/ModalContext';
import { DrawerProvider } from '../drawer/DrawerContext';
import { SonnerProvider } from '../sonner/SonnerContext';
import { DialogProvider } from '../alertDialog/DialogContext';

interface LayoutProvidersProps {
  children: ReactNode;
}

/** Wraps layout content with Modal, Drawer, Sonner and Dialog providers. */
export function LayoutProviders({ children }: LayoutProvidersProps) {
  return (
    <ModalProvider>
      <DrawerProvider>
        <SonnerProvider>
          <DialogProvider>{children}</DialogProvider>
        </SonnerProvider>
      </DrawerProvider>
    </ModalProvider>
  );
}
