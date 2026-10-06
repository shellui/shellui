import { describe, expect, it } from 'vitest';
import { AiRegistry } from './registry.js';
import type { AiAdapter, AiModel, AiPromptOptions, AiStreamChunk } from './types.js';

class FakeAdapter implements AiAdapter {
  readonly id: 'ollama' | 'webllm';
  private readonly models: AiModel[];

  constructor(id: 'ollama' | 'webllm', models: AiModel[]) {
    this.id = id;
    this.models = models;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async listModels(): Promise<AiModel[]> {
    return this.models;
  }

  async load(): Promise<void> {}

  async prompt(options: AiPromptOptions): Promise<string> {
    return `echo:${options.modelId}:${options.prompt}`;
  }

  async *promptStreaming(options: AiPromptOptions): AsyncIterable<AiStreamChunk> {
    yield { text: `chunk:${options.prompt}`, done: true };
  }

  async unload(): Promise<void> {}
}

describe('AiRegistry', () => {
  it('lists models from every adapter', async () => {
    const registry = new AiRegistry({
      adapters: [
        new FakeAdapter('ollama', [
          {
            id: 'ollama:llama',
            name: 'llama',
            provider: 'ollama',
            status: 'ready',
          },
        ]),
        new FakeAdapter('webllm', [
          {
            id: 'webllm:tiny',
            name: 'tiny',
            provider: 'webllm',
            status: 'downloadable',
          },
        ]),
      ],
    });

    const models = await registry.listModels();
    expect(models.map((m) => m.id)).toEqual(['ollama:llama', 'webllm:tiny']);
  });

  it('resolves provider-qualified model ids', async () => {
    const ollama = new FakeAdapter('ollama', [
      { id: 'ollama:llama', name: 'llama', provider: 'ollama', status: 'ready' },
    ]);
    const registry = new AiRegistry({ adapters: [ollama] });
    const resolved = registry.resolveModel('ollama:llama');
    expect(resolved?.adapter).toBe(ollama);
    expect(resolved?.modelId).toBe('llama');
  });

  it('picks a ready default model for availability', async () => {
    const registry = new AiRegistry({
      adapters: [
        new FakeAdapter('ollama', [
          { id: 'ollama:a', name: 'a', provider: 'ollama', status: 'ready' },
          { id: 'ollama:b', name: 'b', provider: 'ollama', status: 'ready' },
        ]),
      ],
      defaultModelId: 'ollama:b',
    });

    const ready = await registry.resolveReadyModel();
    expect(ready?.qualifiedId).toBe('ollama:b');
  });

  it('routes prompt to the owning adapter', async () => {
    const registry = new AiRegistry({
      adapters: [
        new FakeAdapter('ollama', [
          { id: 'ollama:llama', name: 'llama', provider: 'ollama', status: 'ready' },
        ]),
      ],
    });

    await expect(registry.prompt({ modelId: 'ollama:llama', prompt: 'hi' })).resolves.toBe(
      'echo:llama:hi',
    );
  });
});
