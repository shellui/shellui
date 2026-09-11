import { LoadingOverlay } from '../../components/LoadingOverlay';

export function RouteFallback() {
  return (
    <div
      className="relative h-full min-h-full bg-background"
      aria-hidden
    >
      <LoadingOverlay />
    </div>
  );
}
