import {
  CHROME_ACTIONS_MAX_TRAILING,
  CHROME_ACTION_ANIMATIONS,
  CHROME_ACTION_VARIANTS,
  type ChromeActionAnimation,
  type ChromeActionItem,
  type ChromeActionPayloadItem,
  type ChromeActionVariant,
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

function normalizeVariant(
  value: unknown,
  role: string,
  warnings: string[],
): ChromeActionVariant | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && (CHROME_ACTION_VARIANTS as readonly string[]).includes(value)) {
    return value as ChromeActionVariant;
  }
  warnings.push(
    `chrome actions: ${role} has invalid variant ${JSON.stringify(value)} — using default`,
  );
  return undefined;
}

function normalizeAnimate(
  value: unknown,
  role: string,
  warnings: string[],
): ChromeActionAnimation | undefined {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value === 'string' &&
    (CHROME_ACTION_ANIMATIONS as readonly string[]).includes(value)
  ) {
    return value as ChromeActionAnimation;
  }
  warnings.push(`chrome actions: ${role} has invalid animate ${JSON.stringify(value)} — ignored`);
  return undefined;
}

function serializeItem(
  item: ChromeActionItem | undefined,
  role: string,
  warnings: string[],
): ChromeActionPayloadItem | undefined {
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
  const variant = normalizeVariant(item.variant, `${role} "${id}"`, warnings);
  const animate = normalizeAnimate(item.animate, `${role} "${id}"`, warnings);
  return {
    id,
    ...(label ? { label } : {}),
    ...(icon ? { icon } : {}),
    ...(variant ? { variant } : {}),
    ...(item.disabled === true ? { disabled: true } : {}),
    ...(animate ? { animate } : {}),
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

  const variant = normalizeVariant(spec.variant, 'set', warnings);

  const back = serializeItem(spec.back, 'back', warnings);
  if (back) callbackIds.push(back.id);

  const title = normalizeTitle(spec.title);

  const trailingIn = Array.isArray(spec.trailing) ? spec.trailing : [];
  if (trailingIn.length > CHROME_ACTIONS_MAX_TRAILING) {
    warnings.push(
      `chrome actions: trailing capped at ${CHROME_ACTIONS_MAX_TRAILING} (got ${trailingIn.length})`,
    );
  }

  const trailing: ChromeActionPayloadItem[] = [];
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
  if (variant) payload.variant = variant;
  if (back) payload.back = back;
  if (title) payload.title = title;
  if (trailing.length > 0) payload.trailing = trailing;
  if (primary && !seen.has(primary.id)) {
    // Primary FAB ignores button variants — strip so host always uses default FAB style.
    const { variant: _ignored, ...primaryRest } = primary;
    payload.primary = primaryRest;
  }

  return { payload, callbackIds, warnings };
}
