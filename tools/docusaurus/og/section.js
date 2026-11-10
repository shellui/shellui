// @ts-check

/** Folder names that are section labels even when the sidebar groups them elsewhere. */
const FOLDER_LABELS = {
  adr: 'ADR',
  features: 'Features',
  plans: 'Plans',
};

/**
 * @param {string} folder
 * @returns {string}
 */
function labelFromFolder(folder) {
  if (FOLDER_LABELS[folder]) {
    return FOLDER_LABELS[folder];
  }
  return folder
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * @param {unknown} items
 * @param {string[]} categories
 * @param {Map<string, {categories: string[], label: string | null}>} map
 */
function walkSidebar(items, categories, map) {
  if (!Array.isArray(items)) {
    return;
  }
  for (const item of items) {
    if (!item || typeof item === 'function') {
      continue;
    }
    if (typeof item === 'string') {
      map.set(item, {categories, label: null});
      continue;
    }
    if (typeof item !== 'object') {
      continue;
    }
    if (item.type === 'doc' && typeof item.id === 'string') {
      map.set(item.id, {
        categories,
        label: typeof item.label === 'string' ? item.label : null,
      });
      continue;
    }
    if (item.type === 'category') {
      const label = typeof item.label === 'string' ? item.label : '';
      const next = label ? categories.concat(label) : categories;
      const link = item.link;
      if (link && link.type === 'doc' && typeof link.id === 'string') {
        map.set(link.id, {categories, label: label || null});
      }
      walkSidebar(item.items, next, map);
    }
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} sidebars
 * @returns {Map<string, {categories: string[], label: string | null}>}
 */
function indexSidebars(sidebars) {
  /** @type {Map<string, {categories: string[], label: string | null}>} */
  const map = new Map();
  if (!sidebars || typeof sidebars !== 'object') {
    return map;
  }
  for (const items of Object.values(sidebars)) {
    walkSidebar(items, [], map);
  }
  return map;
}

/**
 * Section label shown above the page title.
 * Sidebar category wins when the doc is in the sidebar. `adr/` is always ADR.
 * Package docs use their own sidebar label (CLI, SDK, Core). Folder names cover
 * docs that are not in the sidebar. Service docs with no category use the
 * service name.
 *
 * @param {{
 *   docId: string,
 *   placement?: {categories: string[], label: string | null} | null,
 *   serviceLabel?: string | null,
 * }} input
 * @returns {string | null}
 */
function eyebrowFor({docId, placement, serviceLabel}) {
  if (docId === 'adr' || docId.startsWith('adr/')) {
    return 'ADR';
  }
  const categories = placement && Array.isArray(placement.categories) ? placement.categories : [];
  if (categories.length > 0) {
    const top = categories[0];
    if (top === 'Packages') {
      return placement.label || labelFromFolder(docId.split('/').pop() || docId);
    }
    return top;
  }
  if (docId.includes('/')) {
    return labelFromFolder(docId.split('/')[0]);
  }
  if (serviceLabel) {
    return serviceLabel;
  }
  return null;
}

module.exports = {
  FOLDER_LABELS,
  eyebrowFor,
  indexSidebars,
  labelFromFolder,
};
