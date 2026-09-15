import type { AiTransport } from './transport.js';
import type {
  AiAvailabilityResult,
  AiAvailabilityValue,
  AiCreateResult,
  AiModelInfo,
  AiStatusSnapshot,
  LanguageModelCreateOptions,
} from './types.js';

export type LanguageModelSession = {
  prompt: (input: string) => Promise<string>;
  promptStreaming: (input: string) => AsyncIterable<string>;
  destroy: () => void;
};

/**
 * Prompt API / LanguageModel-shaped façade. Only postMessages — no engine imports.
 */
export class LanguageModelApi {
  constructor(private readonly transport: AiTransport) {}

  async availability(): Promise<AiAvailabilityValue> {
    const result = await this.transport.request<AiAvailabilityResult>({ op: 'availability' });
    return result.availability;
  }

  async create(options: LanguageModelCreateOptions = {}): Promise<LanguageModelSession> {
    const transport = this.transport;
    const created = await transport.request<AiCreateResult>({
      op: 'create',
      model: options.model,
      initialPrompts: options.initialPrompts,
    });

    const sessionId = created.sessionId;
    let destroyed = false;

    const ensureAlive = () => {
      if (destroyed) throw new Error('LanguageModel session was destroyed');
    };

    return {
      prompt: async (input: string) => {
        ensureAlive();
        const data = await transport.request<{ text: string }>({
          op: 'prompt',
          sessionId,
          prompt: input,
        });
        return data.text;
      },
      promptStreaming: (input: string) => {
        ensureAlive();
        return (async function* () {
          const queue: string[] = [];
          let done = false;
          let error: Error | null = null;
          let wake: (() => void) | null = null;

          const pump = transport
            .stream({ op: 'promptStreaming', sessionId, prompt: input }, (chunk) => {
              queue.push(chunk);
              wake?.();
            })
            .then(() => {
              done = true;
              wake?.();
            })
            .catch((err: unknown) => {
              error = err instanceof Error ? err : new Error(String(err));
              done = true;
              wake?.();
            });

          while (!done || queue.length > 0) {
            if (queue.length === 0) {
              await new Promise<void>((resolve) => {
                wake = resolve;
              });
              wake = null;
            }
            while (queue.length > 0) {
              yield queue.shift() as string;
            }
          }

          await pump;
          if (error) throw error;
        })();
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        void transport.request({ op: 'destroy', sessionId }).catch(() => {
          // best-effort
        });
      },
    };
  }
}

export class AiClient {
  readonly languageModel: LanguageModelApi;

  constructor(private readonly transport: AiTransport) {
    this.languageModel = new LanguageModelApi(transport);
  }

  listModels(): Promise<AiModelInfo[]> {
    return this.transport.request<AiModelInfo[]>({ op: 'listModels' });
  }

  getStatus(): Promise<AiStatusSnapshot> {
    return this.transport.request<AiStatusSnapshot>({ op: 'status' });
  }
}
