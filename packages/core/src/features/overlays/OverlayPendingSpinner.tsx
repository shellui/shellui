/**
 * Centered spinner shown while a dynamic overlay waits for the first size report.
 */
export function OverlayPendingSpinner() {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-background"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="size-6 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-muted-foreground"
        aria-hidden
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}
