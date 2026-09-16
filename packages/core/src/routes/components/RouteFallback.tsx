import { LoadingOverlay } from '../../components/LoadingOverlay';
import { isShellUiRootWindow } from '../../features/layouts/chrome/SafeAreaTopbar';

/**
 * Suspense fallback for lazy routes.
 * Nested shell-in-iframe: parent ContentView already shows the loading bar until
 * SHELLUI_INITIALIZED — another bar here reads as a double load / redirect.
 */
export function RouteFallback() {
  if (!isShellUiRootWindow()) {
    return (
      <div
        className="h-full min-h-full bg-background"
        aria-hidden
      />
    );
  }

  return (
    <div
      className="relative h-full min-h-full bg-background"
      aria-hidden
    >
      <LoadingOverlay />
    </div>
  );
}
