import type { ReactNode } from 'react';
import { ModalProvider } from '../modal/ModalContext';
import { DrawerProvider } from '../drawer/DrawerContext';
import { SonnerProvider } from '../sonner/SonnerContext';

interface LayoutProvidersProps {
  children: ReactNode;
}

/** Wraps layout content with Modal, Drawer and Sonner providers.
 * Note: DialogProvider is now at the app level in app.tsx */
export function LayoutProviders({ children }: LayoutProvidersProps) {
  return (
    <ModalProvider>
      <DrawerProvider>
        <SonnerProvider>{children}</SonnerProvider>
      </DrawerProvider>
    </ModalProvider>
  );
}
