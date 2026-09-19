/**
 * WebLLM / MLC in-browser runtime support for Shellui.
 *
 * Chrome, Edge, and Safari (mature WebGPU) are the **recommended** runtimes.
 * Firefox also ships WebGPU, but its implementation is less mature for
 * `@mlc-ai/web-llm` — Install may fail. We no longer hard-block it: Install is
 * allowed everywhere (experimental on Firefox) and real failures surface via
 * the clear `[shellui.ai]` error mapping.
 */

/** Shown as a non-blocking warning on Firefox (Install still allowed). */
export const WEBLLM_EXPERIMENTAL_BROWSER_MESSAGE =
  'Browser models work best in Chrome, Edge, or Safari (WebGPU). Support in this browser is experimental — if Install fails, use Ollama.';

/** Any browser when WebGPU fails inside the WebLLM worker. */
export const WEBLLM_WEBGPU_WORKER_FAILED_MESSAGE =
  'WebGPU failed in the WebLLM worker. Check chrome://gpu (or about:support), try Chrome/Edge/Safari, or use Ollama.';

export type WebLlmBrowserSupport = {
  /** Chrome / Edge / Safari — the recommended runtime. */
  recommended: boolean;
  /** Install is always allowed now; Firefox is experimental. */
  canInstall: true;
  /** Why the browser is not recommended (when `recommended` is false). */
  reason?: 'firefox' | 'other';
  /** Warning text when `recommended` is false (empty string when recommended). */
  detail: string;
};

const WEBGPU_ERROR_RE =
  /webgpu|gpuadapter|gpudevice|device lost|adapter|wgpu|vulkan|metal|dawn|compatible gpu|gpu vendor/i;

/**
 * Cheap UA check for whether WebLLM Install is *recommended* (distinct from the
 * soft WebGPU probe). Install is allowed regardless; this only drives warnings.
 * Injectable `userAgent` for tests.
 */
export function probeWebLlmBrowserSupport(
  userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): WebLlmBrowserSupport {
  const ua = userAgent || '';

  // Firefox desktop + Firefox on iOS (FxiOS).
  if (/firefox\//i.test(ua) || /fxios\//i.test(ua)) {
    return {
      recommended: false,
      canInstall: true,
      reason: 'firefox',
      detail: WEBLLM_EXPERIMENTAL_BROWSER_MESSAGE,
    };
  }

  // Chrome, Edge, Safari, and other UAs: recommended (no amber warning).
  return { recommended: true, canInstall: true, detail: '' };
}

/**
 * Map engine / worker throws to a clear user-facing message.
 * - Firefox + WebGPU-ish → experimental-browser guidance (try Chrome/Edge/Safari or Ollama)
 * - Recommended browser + WebGPU-ish → “WebGPU failed in the WebLLM worker”
 * WebLLM often rejects with a **string** (`err.toString()` from the worker).
 */
export function mapWebLlmRuntimeError(error: unknown, userAgent?: string): string | null {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : typeof ErrorEvent !== 'undefined' && error instanceof ErrorEvent
          ? error.message || formatLoose(error.error)
          : '';
  if (!text) return null;
  const lower = text.toLowerCase();
  const looksLikeWebGpu =
    WEBGPU_ERROR_RE.test(lower) ||
    /not support|unsupported|not implemented|not available|necessary to run the webllm/i.test(
      lower,
    );
  if (!looksLikeWebGpu) return null;

  const support = probeWebLlmBrowserSupport(userAgent);
  if (!support.recommended) {
    return support.detail;
  }
  return WEBLLM_WEBGPU_WORKER_FAILED_MESSAGE;
}

function formatLoose(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  return '';
}
