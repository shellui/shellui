/**
 * Deduplicate concurrent async work so callers share one promise until it settles.
 * Needed for React StrictMode double-mount (refs reset; module slots do not).
 */
export type InFlightSlot<T> = { current: Promise<T> | null };

export const shareInFlight = <T>(slot: InFlightSlot<T>, run: () => Promise<T>): Promise<T> => {
  if (!slot.current) {
    slot.current = run().finally(() => {
      slot.current = null;
    });
  }
  return slot.current;
};
