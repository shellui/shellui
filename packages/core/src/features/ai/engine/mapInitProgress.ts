/**
 * Map WebLLM `InitProgressReport` (or any `{ progress }` object) to a clamped 0–1 ratio.
 * Drive UI from engine reports only — never fake timers.
 */
export function mapInitProgress(report: { progress?: number } | null | undefined): number {
  const value = report?.progress;
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
