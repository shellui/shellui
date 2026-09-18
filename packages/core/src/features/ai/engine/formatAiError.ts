/**
 * Normalize unknown throws for AI install / inference error surfaces.
 * Prefer real Error messages; never collapse to a bare generic string when detail exists.
 */
export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name && error.name !== 'Error' ? `${error.name}: ` : '';
    const message = error.message?.trim();
    if (message) return `${name}${message}`;
    return name ? name.replace(/:\s*$/, '') : 'Unknown Error';
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim();
    }
    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}' && json !== 'null') return json;
    } catch {
      // ignore
    }
  }
  if (error === undefined) return 'undefined';
  if (error === null) return 'null';
  return String(error);
}

export type AiErrorLogExtras = {
  modelId?: string;
  stage?: string;
  progressText?: string;
};

/** Always log raw failure details for operators debugging silent installs. */
export function logAiError(context: string, error: unknown, extras?: AiErrorLogExtras): void {
  const message = formatUnknownError(error);
  const payload: Record<string, unknown> = {
    context,
    message,
    ...extras,
  };
  if (error instanceof Error) {
    payload.name = error.name;
    payload.stack = error.stack;
  } else {
    payload.raw = error;
    try {
      payload.rawJson = JSON.stringify(error);
    } catch {
      payload.rawString = String(error);
    }
  }
  // eslint-disable-next-line no-console -- intentional operator-facing diagnostics
  console.error('[shellui.ai]', context, payload, error);
}

/**
 * Build a user-visible install failure string, optionally anchored to last init progress text.
 */
export function formatInstallFailureMessage(
  error: unknown,
  options?: { progressText?: string; fallback?: string },
): string {
  const base = formatUnknownError(error);
  const useless =
    !base ||
    base === 'Unknown Error' ||
    base === 'undefined' ||
    base === 'null' ||
    base === '[object Object]';
  const detail = useless ? (options?.fallback ?? 'Model download failed') : base;
  const progress = options?.progressText?.trim();
  if (progress) {
    return `${detail} (Failed during: ${progress})`;
  }
  return detail;
}
