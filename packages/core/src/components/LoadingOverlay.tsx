import { LOADING_OVERLAY_DURATION_MS } from '../constants';

export function LoadingOverlay() {
  return (
    <div className="absolute inset-x-0 top-0 z-10">
      <div className="h-1 w-full overflow-hidden bg-muted/30">
        <div
          className="h-full w-0 bg-muted-foreground/50"
          style={{
            animation: `loading-bar-slide ${LOADING_OVERLAY_DURATION_MS}ms linear infinite`,
          }}
        />
      </div>
    </div>
  );
}
