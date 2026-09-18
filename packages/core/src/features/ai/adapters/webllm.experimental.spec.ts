import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { clearBrowserInstalledForTests } from '../browserInstallStore.js';
import { WebLLMEngineService, setSharedWebLLMEngineForTests } from '../engine/webllmEngine.js';
import * as browserSupport from '../webLlmBrowserSupport.js';
import { WebLLMAdapter } from './webllm.js';

vi.mock('../status.js', () => ({
  probeWebGpu: vi.fn(async () => ({ available: true })),
}));

/**
 * Firefox is experimental, NOT hard-blocked.
 * Catalog models stay installable; failures surface via mapped errors instead.
 */
describe('WebLLMAdapter on experimental browsers', () => {
  const memory = new Map<string, string>();
  let engine: WebLLMEngineService;

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });
    clearBrowserInstalledForTests();
    engine = new WebLLMEngineService({
      useTransferToast: false,
      loadModule: async () => {
        throw new Error('WebGPUNotAvailableError: WebGPU is not supported');
      },
      createWorker: () => {
        throw new Error('should not create worker');
      },
    });
    setSharedWebLLMEngineForTests(engine);
    vi.spyOn(browserSupport, 'probeWebLlmBrowserSupport').mockReturnValue({
      recommended: false,
      canInstall: true,
      reason: 'firefox',
      detail: browserSupport.WEBLLM_EXPERIMENTAL_BROWSER_MESSAGE,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await engine.resetForTests();
    setSharedWebLLMEngineForTests(null);
    vi.unstubAllGlobals();
  });

  it('keeps catalog models installable (never "unsupported")', async () => {
    const adapter = new WebLLMAdapter({ engine });
    const models = await adapter.listModels();
    expect(models.every((m) => m.status !== 'unsupported')).toBe(true);
    expect(models.some((m) => m.status === 'downloadable')).toBe(true);
  });

  it('attempts Install and surfaces the mapped WebGPU error (no pre-block)', async () => {
    const adapter = new WebLLMAdapter({ engine });
    await expect(adapter.download('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC')).rejects.toThrow(
      /experimental|Ollama|WebGPU/i,
    );
  });
});
