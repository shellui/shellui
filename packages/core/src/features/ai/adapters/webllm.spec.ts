import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_MODEL_CATALOG } from '../catalog.js';
import {
  clearBrowserInstalledForTests,
  isBrowserModelInstalled,
  removeBrowserModelInstalled,
} from '../browserInstallStore.js';
import { WebLLMEngineService, setSharedWebLLMEngineForTests } from '../engine/webllmEngine.js';
import { WebLLMAdapter } from './webllm.js';

vi.mock('../status.js', () => ({
  probeWebGpu: vi.fn(async () => ({ available: true })),
}));

function createFakeWebLLMModule(options?: { chunks?: string[]; fail?: Error }) {
  return {
    CreateWebWorkerMLCEngine: vi.fn(
      async (
        _worker: unknown,
        _modelId: string,
        config?: { initProgressCallback?: (report: { progress: number; text: string }) => void },
      ) => {
        if (options?.fail) throw options.fail;
        const cb = config?.initProgressCallback;
        cb?.({ progress: 0.25, text: 'Downloading…' });
        cb?.({ progress: 0.75, text: 'Loading…' });
        cb?.({ progress: 1, text: 'Finish loading' });
        return {
          chat: {
            completions: {
              create: vi.fn(async (request: { stream?: boolean }) => {
                if (request.stream) {
                  const chunks = options?.chunks ?? ['Hello', ' world'];
                  return (async function* () {
                    for (const text of chunks) {
                      yield {
                        choices: [{ delta: { content: text }, finish_reason: null }],
                      };
                    }
                    yield {
                      choices: [{ delta: {}, finish_reason: 'stop' }],
                    };
                  })();
                }
                return {
                  choices: [{ message: { content: (options?.chunks ?? ['Hello']).join('') } }],
                };
              }),
            },
          },
          unload: vi.fn(async () => undefined),
          reload: vi.fn(async () => undefined),
          setInitProgressCallback: vi.fn(),
        };
      },
    ),
    deleteModelAllInfoInCache: vi.fn(async () => undefined),
  };
}

function fakeWorker(): Worker {
  return {
    terminate: vi.fn(),
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Worker;
}

describe('WebLLMAdapter + engine', () => {
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
    const module = createFakeWebLLMModule();
    engine = new WebLLMEngineService({
      useTransferToast: false,
      loadModule: async () => module as never,
      createWorker: fakeWorker,
    });
    setSharedWebLLMEngineForTests(engine);
  });

  afterEach(async () => {
    await engine.resetForTests();
    setSharedWebLLMEngineForTests(null);
    vi.unstubAllGlobals();
  });

  it('installs via WebLLM progress callbacks and marks ready', async () => {
    const adapter = new WebLLMAdapter({ engine });
    const progresses: number[] = [];
    await adapter.download('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC', {
      onProgress: (p) => progresses.push(p),
    });
    expect(progresses.some((p) => p > 0 && p < 1)).toBe(true);
    expect(progresses.at(-1)).toBe(1);
    expect(isBrowserModelInstalled('Llama-3.2-1B-Instruct-q4f16_1-MLC')).toBe(true);
    const models = await adapter.listModels();
    expect(models.find((m) => m.id.includes('Llama-3.2'))?.status).toBe('ready');
    expect(BROWSER_MODEL_CATALOG.length).toBeGreaterThan(0);
  });

  it('prompts and streams after install without a second load step', async () => {
    const adapter = new WebLLMAdapter({ engine });
    await adapter.download('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC');
    await expect(
      adapter.prompt({ modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', prompt: 'Hi' }),
    ).resolves.toBe('Hello');

    const chunks: string[] = [];
    for await (const chunk of adapter.promptStreaming({
      modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      prompt: 'Hi',
    })) {
      if (chunk.text) chunks.push(chunk.text);
    }
    expect(chunks.join('')).toBe('Hello world');
  });

  it('cancels an in-flight install', async () => {
    const module = {
      CreateWebWorkerMLCEngine: vi.fn(
        (
          _worker: unknown,
          _modelId: string,
          config?: { initProgressCallback?: (report: { progress: number; text: string }) => void },
        ) => {
          config?.initProgressCallback?.({ progress: 0.1, text: 'start' });
          return new Promise(() => {
            /* intentionally never resolves — cancel must race-abort */
          });
        },
      ),
      deleteModelAllInfoInCache: vi.fn(async () => undefined),
    };
    const slowEngine = new WebLLMEngineService({
      useTransferToast: false,
      loadModule: async () => module as never,
      createWorker: fakeWorker,
    });
    const adapter = new WebLLMAdapter({ engine: slowEngine });
    const download = adapter.download('webllm:Phi-3.5-mini-instruct-q4f16_1-MLC');
    await Promise.resolve();
    await Promise.resolve();
    adapter.cancelDownload('webllm:Phi-3.5-mini-instruct-q4f16_1-MLC');
    await expect(download).rejects.toMatchObject({ name: 'AbortError' });
    expect(isBrowserModelInstalled('Phi-3.5-mini-instruct-q4f16_1-MLC')).toBe(false);
    await slowEngine.resetForTests();
  });

  it('deletes an installed model and clears the record', async () => {
    const adapter = new WebLLMAdapter({ engine });
    await adapter.download('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC');
    await adapter.deleteInstalled('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC');
    expect(isBrowserModelInstalled('Llama-3.2-1B-Instruct-q4f16_1-MLC')).toBe(false);
  });

  it('does not import WebLLM until install', async () => {
    const loadModule = vi.fn(async () => createFakeWebLLMModule() as never);
    const lazyEngine = new WebLLMEngineService({
      useTransferToast: false,
      loadModule,
      createWorker: fakeWorker,
    });
    expect(loadModule).not.toHaveBeenCalled();
    const adapter = new WebLLMAdapter({ engine: lazyEngine });
    await adapter.listModels();
    expect(loadModule).not.toHaveBeenCalled();
    await adapter.download('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC');
    expect(loadModule).toHaveBeenCalledTimes(1);
    await lazyEngine.resetForTests();
  });

  it('refuses prompt when the model is not installed', async () => {
    const adapter = new WebLLMAdapter({ engine });
    removeBrowserModelInstalled('Llama-3.2-1B-Instruct-q4f16_1-MLC');
    await expect(
      adapter.prompt({ modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', prompt: 'Hi' }),
    ).rejects.toThrow(/not installed/i);
  });

  it('surfaces WebLLM string rejections (worker err.toString) in the Install error', async () => {
    const module = createFakeWebLLMModule({
      fail: 'WebGPUNotAvailableError: WebGPU is not supported in your current environment' as unknown as Error,
    });
    // Override to reject with a string like the real WebWorkerMLCEngine client.
    module.CreateWebWorkerMLCEngine = vi.fn(async () => {
      throw 'WebGPUNotAvailableError: WebGPU is not supported in your current environment';
    });
    const failingEngine = new WebLLMEngineService({
      useTransferToast: false,
      loadModule: async () => module as never,
      createWorker: fakeWorker,
    });
    const adapter = new WebLLMAdapter({ engine: failingEngine });
    await expect(adapter.download('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC')).rejects.toThrow(
      /WebGPU failed in the WebLLM worker/i,
    );
    await failingEngine.resetForTests();
  });

  it('surfaces worker.onerror on the main thread instead of hanging', async () => {
    const listeners = new Map<string, Set<EventListener>>();
    const worker = {
      terminate: vi.fn(),
      postMessage: vi.fn(),
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        const set = listeners.get(type) ?? new Set();
        set.add(listener);
        listeners.set(type, set);
      }),
      removeEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.get(type)?.delete(listener);
      }),
    } as unknown as Worker;

    const module = {
      CreateWebWorkerMLCEngine: vi.fn(
        () =>
          new Promise(() => {
            /* hang until worker error */
          }),
      ),
      deleteModelAllInfoInCache: vi.fn(async () => undefined),
    };
    const crashEngine = new WebLLMEngineService({
      useTransferToast: false,
      loadModule: async () => module as never,
      createWorker: () => worker,
    });
    const adapter = new WebLLMAdapter({ engine: crashEngine });
    const download = adapter.download('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC');

    // Wait until createAndLoad attaches the worker error guard.
    await vi.waitFor(() => {
      expect(listeners.get('error')?.size).toBeGreaterThan(0);
    });

    const event = {
      type: 'error',
      message: 'Script error in worker',
      filename: 'webllm.worker.ts',
      lineno: 1,
      error: null,
    } as unknown as Event;
    listeners.get('error')?.forEach((listener) => listener(event));
    await expect(download).rejects.toThrow(/WebLLM worker crashed/i);
    await crashEngine.resetForTests();
  });
});
