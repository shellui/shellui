/**
 * WebLLM / MLC in-browser runtime support for Shellui v1.
 *
 * Chrome and Edge (Chromium + usable WebGPU) are the practical targets.
 * Firefox often exposes `navigator.gpu` but WebGPU is still too immature for
 * `@mlc-ai/web-llm` engine init — Install fails with opaque errors. Safari is
 * similarly unsupported for v1; use Ollama there.
 */

export const WEBLLM_UNSUPPORTED_BROWSER_MESSAGE =
  'Browser models need Chrome or Edge (WebGPU). Use Ollama on this browser.';

/** Chromium (or any browser) when WebGPU fails inside the WebLLM worker. */
export const WEBLLM_WEBGPU_WORKER_FAILED_MESSAGE =
  'WebGPU failed in the WebLLM worker. Check chrome://gpu (or about:support), or use Ollama.';

export type WebLlmBrowserSupport = {
  supported: boolean;
  /** Why Install is blocked when supported is false. */
  reason?: 'firefox' | 'safari' | 'other';
  detail: string;
};

const WEBGPU_ERROR_RE =
  /webgpu|gpuadapter|gpudevice|device lost|adapter|wgpu|vulkan|metal|dawn|compatible gpu|gpu vendor/i;

/**
 * Cheap UA check for WebLLM Install eligibility (distinct from soft WebGPU probe).
 * Injectable `userAgent` for tests.
 */
export function probeWebLlmBrowserSupport(
  userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): WebLlmBrowserSupport {
  const ua = userAgent || '';

  // Firefox desktop + Firefox on iOS (FxiOS).
  if (/firefox\//i.test(ua) || /fxios\//i.test(ua)) {
    return {
      supported: false,
      reason: 'firefox',
      detail: WEBLLM_UNSUPPORTED_BROWSER_MESSAGE,
    };
  }

  // Safari (exclude Chrome/Chromium/Edge/Android which also contain "Safari").
  const isSafari = /safari\//i.test(ua) && !/chrome|chromium|crios|edg|android/i.test(ua);
  if (isSafari) {
    return {
      supported: false,
      reason: 'safari',
      detail: WEBLLM_UNSUPPORTED_BROWSER_MESSAGE,
    };
  }

  return { supported: true, detail: '' };
}

/**
 * Map engine / worker throws to a clear user-facing message.
 * - Firefox/Safari + WebGPU-ish → use Ollama / Chromium
 * - Any browser + WebGPU-ish → “WebGPU failed in the WebLLM worker”
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
  if (!support.supported) {
    return support.detail;
  }
  return WEBLLM_WEBGPU_WORKER_FAILED_MESSAGE;
}

function formatLoose(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  return '';
}
