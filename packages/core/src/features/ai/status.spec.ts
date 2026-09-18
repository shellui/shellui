import { describe, expect, it, vi } from 'vitest';
import { OllamaAdapter } from './adapters/ollama.js';
import { probeOllama, probeWebGpu } from './status.js';

describe('probeOllama', () => {
  it('reports reachable when /api/tags succeeds', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ models: [] }), { status: 200 }),
    );
    const status = await probeOllama({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(status.reachable).toBe(true);
    expect(status.baseUrl).toContain('11434');
  });

  it('soft-fails when fetch throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('Failed to fetch');
    });
    const status = await probeOllama({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(status.reachable).toBe(false);
    expect(status.detail).toMatch(/Failed to fetch/);
  });
});

describe('probeWebGpu', () => {
  it('reports unavailable when navigator.gpu is missing', async () => {
    const status = await probeWebGpu(undefined);
    expect(status.available).toBe(false);
  });

  it('reports available when requestAdapter returns an adapter', async () => {
    const status = await probeWebGpu({
      requestAdapter: async () => ({}),
    });
    expect(status.available).toBe(true);
  });
});

describe('OllamaAdapter', () => {
  it('lists tagged models when Ollama is up', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/tags')) {
        return new Response(
          JSON.stringify({
            models: [{ name: 'llama3.2:latest', size: 2_000_000_000 }],
          }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });

    const adapter = new OllamaAdapter({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const models = await adapter.listModels();
    expect(models).toEqual([
      expect.objectContaining({
        id: 'ollama:llama3.2:latest',
        status: 'ready',
        provider: 'ollama',
      }),
    ]);
  });

  it('returns empty list when Ollama is down', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Network error');
    });
    const adapter = new OllamaAdapter({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(adapter.listModels()).resolves.toEqual([]);
  });

  it('prompts via /api/generate', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({ models: [] }), { status: 200 });
      }
      if (url.endsWith('/api/generate') && init?.method === 'POST') {
        return new Response(JSON.stringify({ response: 'hello world', done: true }), {
          status: 200,
        });
      }
      return new Response('no', { status: 404 });
    });

    const adapter = new OllamaAdapter({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(adapter.prompt({ modelId: 'llama3.2', prompt: 'hi' })).resolves.toBe(
      'hello world',
    );
  });
});
