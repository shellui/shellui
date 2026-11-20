/** Move one path up or down in a display order. Returns null when the move is a no-op. */
export function movePathInOrder(
  paths: readonly string[],
  path: string,
  direction: 'up' | 'down',
): string[] | null {
  const index = paths.indexOf(path);
  if (index < 0) return null;
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= paths.length) return null;
  const next = [...paths];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

export function nextHiddenPaths(input: {
  hiddenPaths: readonly string[];
  path: string;
  hidden: boolean;
  locked: boolean;
}): { ok: true; hiddenPaths: string[] } | { ok: false; error: 'locked' } {
  if (input.locked) return { ok: false, error: 'locked' };
  if (input.hidden) {
    return { ok: true, hiddenPaths: [...new Set([...input.hiddenPaths, input.path])] };
  }
  return { ok: true, hiddenPaths: input.hiddenPaths.filter((path) => path !== input.path) };
}
