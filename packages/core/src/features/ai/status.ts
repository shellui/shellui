import type { AiRuntimeStatus } from './types.js';

export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

/** Soft WebGPU probe for Settings → AI. Never throws. */
export async function probeWebGpu(
  gpu: { requestAdapter?: () => Promise<unknown> } | undefined = (
    globalThis as { navigator?: { gpu?: { requestAdapter?: () => Promise<unknown> } } }
  ).navigator?.gpu,
): Promise<AiRuntimeStatus['webGpu']> {
  if (!gpu || typeof gpu.requestAdapter !== 'function') {
    return { available: false, detail: 'WebGPU is not exposed in this browser.' };
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return { available: false, detail: 'No WebGPU adapter (GPU blocked or unsupported).' };
    }
    return { available: true };
  } catch (error) {
    return {
      available: false,
      detail: error instanceof Error ? error.message : 'WebGPU probe failed.',
    };
  }
}

export type ProbeOllamaOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** Soft Ollama probe. Soft-fails when offline, CORS-blocked, or timed out. */
export async function probeOllama(
  options: ProbeOllamaOptions = {},
): Promise<AiRuntimeStatus['ollama']> {
  const baseUrl = (options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 2_000;

  if (typeof fetchImpl !== 'function') {
    return { reachable: false, baseUrl, detail: 'fetch is unavailable.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      return {
        reachable: false,
        baseUrl,
        detail: `Ollama responded with HTTP ${response.status}.`,
        latencyMs,
      };
    }
    return { reachable: true, baseUrl, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const aborted =
      (error instanceof Error && error.name === 'AbortError') ||
      (typeof DOMException !== 'undefined' &&
        error instanceof DOMException &&
        error.name === 'AbortError');
    return {
      reachable: false,
      baseUrl,
      latencyMs,
      detail: aborted
        ? 'Ollama did not respond in time (is it running?).'
        : error instanceof Error
          ? error.message
          : 'Ollama probe failed.',
    };
  } finally {
    clearTimeout(timer);
  }
}
