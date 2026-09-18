import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { clearBrowserInstalledForTests } from '../browserInstallStore.js';
import { WebLLMEngineService, setSharedWebLLMEngineForTests } from '../engine/webllmEngine.js';
import * as browserSupport from '../webLlmBrowserSupport.js';
import { WebLLMAdapter } from './webllm.js';

vi.mock('../status.js', () => ({
  probeWebGpu: vi.fn(async () => ({ available: true })),
}));

describe('WebLLMAdapter unsupported browser', () => {
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
        throw new Error('should not load');
      },
      createWorker: () => {
        throw new Error('should not create worker');
      },
    });
    setSharedWebLLMEngineForTests(engine);
    vi.spyOn(browserSupport, 'probeWebLlmBrowserSupport').mockReturnValue({
      supported: false,
      reason: 'firefox',
      detail: browserSupport.WEBKLLM_UNSUPPORTED_BROWSER_MESSAGE,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await engine.resetForTests();
    setSharedWebLLMEngineForTests(null);
    vi.unstubAllGlobals();
  });

  it('lists catalog models as unsupported and blocks download', async () => {
    const adapter = new WebLLMAdapter({ engine });
    const models = await adapter.listModels();
    expect(models.every((m) => m.status === 'unsupported')).toBe(true);
    await expect(adapter.download('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC')).rejects.toThrow(
      /Chrome or Edge/,
    );
  });
});
