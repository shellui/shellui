import { describe, expect, it, vi } from 'vitest';
import { PromptApiAdapter, PROMPT_API_MODEL_ID } from './promptApi.js';
import type { NormalizedPromptApi, PromptApiSession } from '../promptApiSupport.js';

function fakeApi(options: {
  availability?: string;
  streamChunks?: string[];
  onCreate?: (opts: unknown) => void;
}): NormalizedPromptApi {
  const availability = options.availability ?? 'available';
  return {
    availability: async () => availability as never,
    create: async (opts) => {
      options.onCreate?.(opts);
      const session: PromptApiSession = {
        prompt: async (input: string) => `echo:${input}`,
        promptStreaming: (_input: string) =>
          (async function* () {
            for (const chunk of options.streamChunks ?? ['Hello', ' world']) {
              yield chunk;
            }
          })(),
        destroy: vi.fn(),
      };
      return session;
    },
  };
}

describe('PromptApiAdapter', () => {
  it('lists nothing when the Prompt API is absent (provider hidden entirely)', async () => {
    const adapter = new PromptApiAdapter({ getApi: () => null });
    expect(await adapter.listModels()).toEqual([]);
    expect(await adapter.isAvailable()).toBe(false);
  });

  it('lists nothing when availability is unavailable', async () => {
    const adapter = new PromptApiAdapter({
      getApi: () => fakeApi({ availability: 'unavailable' }),
    });
    expect(await adapter.listModels()).toEqual([]);
    expect(await adapter.isAvailable()).toBe(false);
  });

  it('exposes one ready model when available', async () => {
    const adapter = new PromptApiAdapter({ getApi: () => fakeApi({ availability: 'available' }) });
    const models = await adapter.listModels();
    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: PROMPT_API_MODEL_ID,
      provider: 'prompt-api',
      status: 'ready',
    });
    expect(await adapter.isAvailable()).toBe(true);
  });

  it('marks the model downloadable / downloading per availability', async () => {
    const downloadable = new PromptApiAdapter({
      getApi: () => fakeApi({ availability: 'downloadable' }),
    });
    expect((await downloadable.listModels())[0]?.status).toBe('downloadable');
    const downloading = new PromptApiAdapter({
      getApi: () => fakeApi({ availability: 'downloading' }),
    });
    expect((await downloading.listModels())[0]?.status).toBe('downloading');
  });

  it('prompts via a fresh session and seeds history as initialPrompts', async () => {
    const created: unknown[] = [];
    const adapter = new PromptApiAdapter({
      getApi: () => fakeApi({ onCreate: (opts) => created.push(opts) }),
    });
    const answer = await adapter.prompt({
      modelId: 'default',
      prompt: 'ignored',
      messages: [
        { role: 'system', content: 'be brief' },
        { role: 'user', content: 'hello' },
      ],
    });
    expect(answer).toBe('echo:hello');
    expect(created[0]).toMatchObject({
      initialPrompts: [{ role: 'system', content: 'be brief' }],
    });
  });

  it('streams deltas (normalizing cumulative chunks)', async () => {
    const adapter = new PromptApiAdapter({
      getApi: () => fakeApi({ streamChunks: ['Hello', 'Hello world'] }),
    });
    const parts: string[] = [];
    for await (const chunk of adapter.promptStreaming({ modelId: 'default', prompt: 'hi' })) {
      if (chunk.text) parts.push(chunk.text);
    }
    expect(parts.join('')).toBe('Hello world');
  });

  it('streams deltas (already-incremental chunks)', async () => {
    const adapter = new PromptApiAdapter({
      getApi: () => fakeApi({ streamChunks: ['Hel', 'lo', ' world'] }),
    });
    const parts: string[] = [];
    for await (const chunk of adapter.promptStreaming({ modelId: 'default', prompt: 'hi' })) {
      if (chunk.text) parts.push(chunk.text);
    }
    expect(parts.join('')).toBe('Hello world');
  });
});
