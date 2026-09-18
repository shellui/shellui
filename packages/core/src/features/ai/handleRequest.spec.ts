import { describe, expect, it } from 'vitest';
import type { Settings } from '@shellui/sdk';
import { AiRegistry } from './registry.js';
import type { AiAdapter, AiModel, AiPromptOptions, AiStreamChunk } from './types.js';
import { handleAiRequest, type AiSession } from './handleRequest.js';

class ReadyAdapter implements AiAdapter {
  readonly id = 'ollama' as const;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async listModels(): Promise<AiModel[]> {
    return [{ id: 'ollama:llama', name: 'llama', provider: 'ollama', status: 'ready' }];
  }

  async load(): Promise<void> {}

  async prompt(options: AiPromptOptions): Promise<string> {
    return `reply:${options.prompt}`;
  }

  async *promptStreaming(options: AiPromptOptions): AsyncIterable<AiStreamChunk> {
    yield { text: `s:${options.prompt}`, done: true };
  }

  async unload(): Promise<void> {}
}

const baseSettings = {
  developerFeatures: { enabled: false },
  errorReporting: { enabled: false },
  logging: { namespaces: { shellsdk: false, shellcore: false } },
  appearance: {
    name: 'default',
    displayName: 'Default',
    mode: 'light',
    colorScheme: 'system',
    colors: { light: {}, dark: {} },
  },
  language: { code: 'en' },
  region: { timezone: 'UTC' },
  ai: {
    enabled: true,
    defaultModelId: 'ollama:llama',
    ollamaEnabled: true,
    browserEnabled: true,
  },
  user: null,
  accessToken: null,
} as Settings;

describe('handleAiRequest', () => {
  it('reports availability when a ready model exists', async () => {
    const registry = new AiRegistry({ adapters: [new ReadyAdapter()] });
    const result = await handleAiRequest(
      {
        registry,
        sessions: new Map(),
        getSettings: () => baseSettings,
      },
      { id: '1', op: 'availability' },
    );
    expect(result.response.data).toEqual({ availability: 'available' });
  });

  it('returns unavailable when AI is disabled', async () => {
    const registry = new AiRegistry({ adapters: [new ReadyAdapter()] });
    const result = await handleAiRequest(
      {
        registry,
        sessions: new Map(),
        getSettings: () => ({
          ...baseSettings,
          ai: { ...baseSettings.ai, enabled: false },
        }),
      },
      { id: '2', op: 'availability' },
    );
    expect(result.response.data).toEqual({ availability: 'unavailable' });
  });

  it('creates a session and prompts', async () => {
    const registry = new AiRegistry({ adapters: [new ReadyAdapter()] });
    const sessions = new Map<string, AiSession>();
    const created = await handleAiRequest(
      { registry, sessions, getSettings: () => baseSettings },
      { id: '3', op: 'create' },
    );
    const data = created.response.data as { sessionId: string; model: string };
    expect(data.model).toBe('ollama:llama');
    expect(sessions.has(data.sessionId)).toBe(true);

    const prompted = await handleAiRequest(
      { registry, sessions, getSettings: () => baseSettings },
      { id: '4', op: 'prompt', sessionId: data.sessionId, prompt: 'hi' },
    );
    expect(prompted.response.data).toEqual({ text: 'reply:hi' });
  });

  it('streams chunks for promptStreaming', async () => {
    const registry = new AiRegistry({ adapters: [new ReadyAdapter()] });
    const sessions = new Map<string, AiSession>();
    const created = await handleAiRequest(
      { registry, sessions, getSettings: () => baseSettings },
      { id: '5', op: 'create' },
    );
    const sessionId = (created.response.data as { sessionId: string }).sessionId;

    const streamed = await handleAiRequest(
      { registry, sessions, getSettings: () => baseSettings },
      { id: '6', op: 'promptStreaming', sessionId, prompt: 'x' },
    );
    expect(streamed.stream).toBeDefined();
    const stream = streamed.stream;
    if (!stream) {
      throw new Error('expected stream');
    }
    const chunks: string[] = [];
    for await (const part of stream) {
      if (part.chunk) chunks.push(part.chunk);
    }
    expect(chunks).toContain('s:x');
  });

  it('accumulates multi-turn history on a reused session', async () => {
    const seen: AiPromptOptions[] = [];
    class CaptureAdapter extends ReadyAdapter {
      async prompt(options: AiPromptOptions): Promise<string> {
        seen.push(options);
        return `reply:${options.prompt}`;
      }

      async *promptStreaming(options: AiPromptOptions): AsyncIterable<AiStreamChunk> {
        seen.push(options);
        yield { text: `s:${options.prompt}`, done: true };
      }
    }

    const registry = new AiRegistry({ adapters: [new CaptureAdapter()] });
    const sessions = new Map<string, AiSession>();
    const created = await handleAiRequest(
      { registry, sessions, getSettings: () => baseSettings },
      {
        id: 'h1',
        op: 'create',
        initialPrompts: [{ role: 'system', content: 'sys' }],
      },
    );
    const sessionId = (created.response.data as { sessionId: string }).sessionId;
    const session = sessions.get(sessionId);
    expect(session?.systemPrompt).toBe('sys');
    expect(session?.messages).toEqual([]);

    await handleAiRequest(
      { registry, sessions, getSettings: () => baseSettings },
      { id: 'h2', op: 'prompt', sessionId, prompt: 'one' },
    );
    expect(session?.messages).toEqual([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'reply:one' },
    ]);
    expect(seen[0]?.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'one' },
    ]);

    const streamed = await handleAiRequest(
      { registry, sessions, getSettings: () => baseSettings },
      { id: 'h3', op: 'promptStreaming', sessionId, prompt: 'two' },
    );
    for await (const _ of streamed.stream ?? []) {
      // drain
    }
    expect(session?.messages).toEqual([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'reply:one' },
      { role: 'user', content: 'two' },
      { role: 'assistant', content: 's:two' },
    ]);
    expect(seen[1]?.messages?.at(-1)).toEqual({ role: 'user', content: 'two' });
    expect(
      seen[1]?.messages?.some((m) => m.role === 'assistant' && m.content === 'reply:one'),
    ).toBe(true);
  });
});
