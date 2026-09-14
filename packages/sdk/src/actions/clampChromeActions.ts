import {
  CHROME_ACTIONS_MAX_TRAILING,
  type ChromeActionItem,
  type ChromeActionsPayload,
  type ChromeActionsSpec,
} from '../types.js';

export type ClampChromeActionsResult = {
  payload: ChromeActionsPayload;
  /** Action ids whose `onClick` should be registered in the callback registry. */
  callbackIds: string[];
  warnings: string[];
};

function normalizeTitle(title: ChromeActionsSpec['title']): string | undefined {
  if (title === null || title === undefined) return undefined;
  if (typeof title === 'string') {
    const text = title.trim();
    return text.length > 0 ? text : undefined;
  }
  const text = typeof title.text === 'string' ? title.text.trim() : '';
  return text.length > 0 ? text : undefined;
}

function serializeItem(
  item: ChromeActionItem | undefined,
  role: string,
  warnings: string[],
): { id: string; label?: string; icon?: string } | undefined {
  if (!item) return undefined;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  if (!id) {
    warnings.push(`chrome actions: ${role} is missing a non-empty id — skipped`);
    return undefined;
  }
  const label = typeof item.label === 'string' ? item.label.trim() : undefined;
  const icon = typeof item.icon === 'string' ? item.icon.trim() : undefined;
  if (!label && !icon && role !== 'back') {
    warnings.push(`chrome actions: ${role} "${id}" has neither label nor icon`);
  }
  return {
    id,
    ...(label ? { label } : {}),
    ...(icon ? { icon } : {}),
  };
}

/**
 * Validate and clamp a chrome-actions spec into a serializable payload.
 * Caps: 1 back, 1 title, ≤{@link CHROME_ACTIONS_MAX_TRAILING} trailing, 1 primary.
 * Host UI shows ≤3 trailing and puts the rest in `···`.
 */
export function clampChromeActions(
  spec: ChromeActionsSpec | null | undefined,
): ClampChromeActionsResult {
  const warnings: string[] = [];
  const callbackIds: string[] = [];

  if (!spec || typeof spec !== 'object') {
    return { payload: {}, callbackIds, warnings };
  }

  const back = serializeItem(spec.back, 'back', warnings);
  if (back) callbackIds.push(back.id);

  const title = normalizeTitle(spec.title);

  const trailingIn = Array.isArray(spec.trailing) ? spec.trailing : [];
  if (trailingIn.length > CHROME_ACTIONS_MAX_TRAILING) {
    warnings.push(
      `chrome actions: trailing capped at ${CHROME_ACTIONS_MAX_TRAILING} (got ${trailingIn.length})`,
    );
  }

  const trailing: Array<{ id: string; label?: string; icon?: string }> = [];
  const seen = new Set<string>();
  if (back) seen.add(back.id);

  for (const raw of trailingIn.slice(0, CHROME_ACTIONS_MAX_TRAILING)) {
    const item = serializeItem(raw, 'trailing', warnings);
    if (!item) continue;
    if (seen.has(item.id)) {
      warnings.push(`chrome actions: duplicate id "${item.id}" — skipped`);
      continue;
    }
    seen.add(item.id);
    trailing.push(item);
    callbackIds.push(item.id);
  }

  const primary = serializeItem(spec.primary, 'primary', warnings);
  if (primary) {
    if (seen.has(primary.id)) {
      warnings.push(
        `chrome actions: primary id "${primary.id}" collides with another action — skipped`,
      );
    } else {
      callbackIds.push(primary.id);
    }
  }

  const payload: ChromeActionsPayload = {};
  if (back) payload.back = back;
  if (title) payload.title = title;
  if (trailing.length > 0) payload.trailing = trailing;
  if (primary && !seen.has(primary.id)) payload.primary = primary;

  return { payload, callbackIds, warnings };
}
