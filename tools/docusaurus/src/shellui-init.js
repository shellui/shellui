import { shellui } from '@shellui/sdk';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

if (ExecutionEnvironment.canUseDOM) {
  // Initialize the ShellUI SDK
  shellui.init();
}

/**
 * Docusaurus client module lifecycle hook
 * Called whenever the route changes
 */
export function onRouteUpdate({ location }) {
  if (ExecutionEnvironment.canUseDOM) {
    // Manually trigger a sync with the parent frame on every route change
    // This ensures that Docusaurus transitions are captured immediately
    // shellui.notifyParent();
  }
}
