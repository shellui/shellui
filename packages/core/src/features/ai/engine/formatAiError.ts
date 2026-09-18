/**
 * Normalize unknown throws for AI install / inference error surfaces.
 * Prefer real Error messages; never collapse to a bare generic string when detail exists.
 *
 * WebLLM's worker client rejects with **strings** (`err.toString()` from the worker),
 * not Error instances — handle those explicitly.
 */

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name && error.name !== 'Error' ? `${error.name}: ` : '';
    const message = error.message?.trim();
    if (message) return `${name}${message}`;
    // Empty Error.message — try cause / stack first line before giving up.
    if (error.cause !== undefined) {
      const causeText = formatUnknownError(error.cause);
      if (causeText && !isUselessErrorText(causeText)) {
        return `${name || 'Error: '}(cause) ${causeText}`;
      }
    }
    return name ? name.replace(/:\s*$/, '') : 'Unknown Error';
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  // Worker `error` / `messageerror` events (main-thread Worker listeners).
  if (typeof ErrorEvent !== 'undefined' && error instanceof ErrorEvent) {
    const parts = [
      error.message?.trim(),
      error.filename ? `${error.filename}:${error.lineno ?? 0}` : '',
      error.error ? formatUnknownError(error.error) : '',
    ].filter(Boolean);
    if (parts.length) return parts.join(' — ');
  }
  if (typeof MessageEvent !== 'undefined' && error instanceof MessageEvent) {
    return `Worker messageerror: ${formatUnknownError(error.data)}`;
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

function isUselessErrorText(text: string): boolean {
  const t = text.trim();
  return (
    !t ||
    t === 'Unknown Error' ||
    t === 'undefined' ||
    t === 'null' ||
    t === '[object Object]' ||
    t === 'Error' ||
    t === 'Model download failed'
  );
}

export type AiErrorLogExtras = {
  modelId?: string;
  stage?: string;
  progressText?: string;
  /** True when initProgressCallback never reported HF / load progress. */
  beforeModelFetch?: boolean;
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
    if (error.cause !== undefined) {
      payload.cause = formatUnknownError(error.cause);
    }
  } else {
    payload.raw = error;
    payload.rawType = typeof error;
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
  options?: {
    progressText?: string;
    fallback?: string;
    /** No init progress yet → failure was before HF weights fetch. */
    beforeModelFetch?: boolean;
  },
): string {
  const base = formatUnknownError(error);
  const useless = isUselessErrorText(base);
  let detail = useless ? (options?.fallback ?? 'Model download failed') : base;

  if (useless && options?.beforeModelFetch) {
    detail =
      'WebLLM engine init failed before model download (no Hugging Face traffic yet). ' +
      'Open DevTools → Worker console/Network for the webllm worker, or check WebGPU.';
  } else if (!useless && options?.beforeModelFetch) {
    detail = `${detail} — failed before Hugging Face fetch (worker/GPU init).`;
  }

  const progress = options?.progressText?.trim();
  if (progress) {
    return `${detail} (Failed during: ${progress})`;
  }
  return detail;
}
