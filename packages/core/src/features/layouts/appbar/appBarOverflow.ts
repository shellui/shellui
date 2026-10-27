/**
 * Pick which app-bar entries stay in the bar; the rest go into More.
 * The active entry always stays visible (it is placed first in the budget),
 * then the others fill the remaining width in their configured order.
 *
 * @returns sorted indices of the visible entries.
 */
export function pickVisibleEntries({
  widths,
  available,
  moreWidth,
  gap,
  activeIndex = -1,
}: {
  widths: number[];
  available: number;
  moreWidth: number;
  gap: number;
  activeIndex?: number;
}): number[] {
  const all = widths.map((_, i) => i);
  const total = widths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0);
  if (total <= available) return all;

  const budget = available - gap - moreWidth;
  const picked: number[] = [];
  let used = 0;
  const tryAdd = (i: number): boolean => {
    const next = used + (picked.length > 0 ? gap : 0) + widths[i];
    if (next > budget) return false;
    used = next;
    picked.push(i);
    return true;
  };

  if (activeIndex >= 0 && activeIndex < widths.length) tryAdd(activeIndex);
  for (const i of all) {
    if (i === activeIndex) continue;
    if (!tryAdd(i)) break;
  }
  return picked.sort((a, b) => a - b);
}
