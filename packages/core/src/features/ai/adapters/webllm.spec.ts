import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { clearBrowserInstalledForTests, isBrowserModelInstalled } from '../browserInstallStore.js';
import { WebLLMAdapter } from './webllm.js';

vi.mock('../status.js', () => ({
  probeWebGpu: vi.fn(async () => ({ available: true })),
}));

describe('WebLLMAdapter download stub', () => {
  const memory = new Map<string, string>();

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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('records a catalog install with progress and survives listModels', async () => {
    const adapter = new WebLLMAdapter();
    const progresses: number[] = [];
    const download = adapter.download('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC', {
      onProgress: (p) => progresses.push(p),
    });
    await vi.runAllTimersAsync();
    await download;
    expect(progresses.at(-1)).toBe(1);
    expect(isBrowserModelInstalled('Llama-3.2-1B-Instruct-q4f16_1-MLC')).toBe(true);
    const models = await adapter.listModels();
    expect(models.find((m) => m.id.includes('Llama-3.2'))?.status).toBe('ready');
  });

  it('cancels an in-flight stub download', async () => {
    const adapter = new WebLLMAdapter();
    const controller = new AbortController();
    const download = adapter.download('webllm:Phi-3.5-mini-instruct-q4f16_1-MLC', {
      signal: controller.signal,
    });
    // Advance one tick so the loop is mid-flight, then abort.
    await vi.advanceTimersByTimeAsync(80);
    controller.abort();
    await expect(download).rejects.toMatchObject({ name: 'AbortError' });
    expect(isBrowserModelInstalled('Phi-3.5-mini-instruct-q4f16_1-MLC')).toBe(false);
  });

  it('deletes an installed catalog record', async () => {
    const adapter = new WebLLMAdapter();
    adapter.markInstalled('Llama-3.2-1B-Instruct-q4f16_1-MLC');
    await adapter.deleteInstalled('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC');
    expect(isBrowserModelInstalled('Llama-3.2-1B-Instruct-q4f16_1-MLC')).toBe(false);
  });
});
