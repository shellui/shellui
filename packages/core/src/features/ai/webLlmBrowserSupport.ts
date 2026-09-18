/**
 * WebLLM / MLC in-browser runtime support for Shellui v1.
 *
 * Chrome and Edge (Chromium + usable WebGPU) are the practical targets.
 * Firefox often exposes `navigator.gpu` but WebGPU is still too immature for
 * `@mlc-ai/web-llm` engine init — Install fails with opaque errors. Safari is
 * similarly unsupported for v1; use Ollama there.
 */

export const WEBKLLM_UNSUPPORTED_BROWSER_MESSAGE =
  'Browser models need Chrome or Edge (WebGPU). Use Ollama on this browser.';

export type WebLlmBrowserSupport = {
  supported: boolean;
  /** Why Install is blocked when supported is false. */
  reason?: 'firefox' | 'safari' | 'other';
  detail: string;
};

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
      detail: WEBKLLM_UNSUPPORTED_BROWSER_MESSAGE,
    };
  }

  // Safari (exclude Chrome/Chromium/Edge/Android which also contain "Safari").
  const isSafari = /safari\//i.test(ua) && !/chrome|chromium|crios|edg|android/i.test(ua);
  if (isSafari) {
    return {
      supported: false,
      reason: 'safari',
      detail: WEBKLLM_UNSUPPORTED_BROWSER_MESSAGE,
    };
  }

  return { supported: true, detail: '' };
}

/** Map engine throws that look like Firefox/WebGPU init failures to the clear message. */
export function mapWebLlmRuntimeError(error: unknown, userAgent?: string): string | null {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  if (!text) return null;
  const lower = text.toLowerCase();
  if (
    /webgpu|gpuadapter|gpudevice|device lost|adapter|wgpu|vulkan|metal|dawn/i.test(lower) ||
    /not support|unsupported|not implemented|not available/i.test(lower)
  ) {
    const support = probeWebLlmBrowserSupport(userAgent);
    if (!support.supported) {
      return support.detail;
    }
  }
  return null;
}
