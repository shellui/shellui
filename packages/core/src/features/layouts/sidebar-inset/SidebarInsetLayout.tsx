import { SidebarLayout } from '../sidebar/SidebarLayout';
import type { SidebarLayoutProps } from '../sidebar/types';

/**
 * Sidebar inset layout — same as sidebar, with a padded, rounded main frame that
 * reveals the chrome background around the content area (desktop).
 */
export function SidebarInsetLayout(props: SidebarLayoutProps) {
  return (
    <SidebarLayout
      {...props}
      variant="inset"
    />
  );
}
