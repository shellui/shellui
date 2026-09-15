import { describe, expect, it, vi } from 'vitest';
import { LanguageModelApi } from './languageModel.js';
import type { AiTransport } from './transport.js';

describe('LanguageModelApi', () => {
  it('maps availability through the transport', async () => {
    const transport: AiTransport = {
      request: vi.fn(async () => ({ availability: 'unavailable' as const })),
      stream: vi.fn(async () => undefined),
    };
    const api = new LanguageModelApi(transport);
    await expect(api.availability()).resolves.toBe('unavailable');
    expect(transport.request).toHaveBeenCalledWith({ op: 'availability' });
  });

  it('creates a session that prompts via messaging', async () => {
    const transport: AiTransport = {
      request: vi.fn(async (payload) => {
        if (payload.op === 'create') {
          return { sessionId: 'sess-1', model: 'ollama:llama' };
        }
        if (payload.op === 'prompt') {
          expect(payload.sessionId).toBe('sess-1');
          expect(payload.prompt).toBe('Summarize');
          return { text: 'ok' };
        }
        if (payload.op === 'destroy') {
          return {};
        }
        throw new Error(`unexpected op ${payload.op}`);
      }),
      stream: vi.fn(async () => undefined),
    };

    const api = new LanguageModelApi(transport);
    const session = await api.create({ model: 'ollama:llama' });
    await expect(session.prompt('Summarize')).resolves.toBe('ok');
    session.destroy();
    expect(transport.request).toHaveBeenCalledWith({ op: 'destroy', sessionId: 'sess-1' });
  });

  it('yields streaming chunks from transport.stream', async () => {
    const transport: AiTransport = {
      request: vi.fn(async () => ({ sessionId: 's', model: 'ollama:x' })),
      stream: vi.fn(async (_payload, onChunk) => {
        onChunk('Hel');
        onChunk('lo');
      }),
    };
    const api = new LanguageModelApi(transport);
    const session = await api.create();
    const chunks: string[] = [];
    for await (const chunk of session.promptStreaming('hi')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['Hel', 'lo']);
  });
});
