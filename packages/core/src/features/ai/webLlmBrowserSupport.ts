/**
 * WebLLM / MLC in-browser runtime support for Shellui.
 *
 * Chrome and Edge (Chromium + mature WebGPU) are the **recommended** runtime.
 * Firefox and Safari ship WebGPU too, but their implementations are less mature
 * for `@mlc-ai/web-llm` — Install may fail. We no longer hard-block them: Install
 * is allowed everywhere (experimental) and real failures surface via the clear
 * `[shellui.ai]` error mapping. Desktop Safari (WebKit) ≠ Chrome (Blink).
 */

/** Shown as a non-blocking warning on non-Chromium browsers (Install still allowed). */
export const WEBLLM_EXPERIMENTAL_BROWSER_MESSAGE =
  'Browser models work best in Chrome or Edge (WebGPU). Support in this browser is experimental — if Install fails, use Ollama.';

/** Any browser when WebGPU fails inside the WebLLM worker. */
export const WEBLLM_WEBGPU_WORKER_FAILED_MESSAGE =
  'WebGPU failed in the WebLLM worker. Check chrome://gpu (or about:support), try Chrome/Edge, or use Ollama.';

export type WebLlmBrowserSupport = {
  /** Chromium + mature WebGPU — the recommended runtime. */
  recommended: boolean;
  /** Install is always allowed now; non-Chromium is experimental. */
  canInstall: true;
  /** Why the browser is not recommended (when `recommended` is false). */
  reason?: 'firefox' | 'safari' | 'other';
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

  // Safari (exclude Chrome/Chromium/Edge/Android which also contain "Safari").
  const isSafari = /safari\//i.test(ua) && !/chrome|chromium|crios|edg|android/i.test(ua);
  if (isSafari) {
    return {
      recommended: false,
      canInstall: true,
      reason: 'safari',
      detail: WEBLLM_EXPERIMENTAL_BROWSER_MESSAGE,
    };
  }

  return { recommended: true, canInstall: true, detail: '' };
}

/**
 * Map engine / worker throws to a clear user-facing message.
 * - Non-Chromium + WebGPU-ish → experimental-browser guidance (try Chrome/Edge or Ollama)
 * - Chromium + WebGPU-ish → “WebGPU failed in the WebLLM worker”
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
