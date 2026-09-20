import type {
  AiAdapter,
  AiModel,
  AiModelStatus,
  AiPromptOptions,
  AiStreamChunk,
} from '../types.js';
import {
  getPromptApi,
  type NormalizedPromptApi,
  type PromptApiSession,
  type PromptMessage,
} from '../promptApiSupport.js';

/** Single logical model exposed by the built-in Prompt API. */
export const PROMPT_API_MODEL_ID = 'prompt-api:default';

export type PromptApiAdapterOptions = {
  /** Injectable resolver (tests). Defaults to the live Chrome global. */
  getApi?: () => NormalizedPromptApi | null;
};

/**
 * Chrome built-in **Prompt API** (`LanguageModel` / Gemini Nano) adapter.
 *
 * Shown only when the API is present *and* usable: `listModels` returns `[]` when
 * the global is missing (Firefox/Safari/iPhone/older Chrome) or `availability()`
 * is `unavailable`, so Settings omits the provider entirely — no warning, no stub.
 *
 * Settings UX is **Enable** (not Install/Download): Chrome often reports no
 * transferable download progress, so a stuck 0% bar is wrong. The adapter's
 * `download()` method is the warm/`create({ monitor })` path; callers must treat
 * missing/zero progress as indeterminate setup.
 *
 * Conversations are **stateless** here: like Ollama, each prompt spins a fresh
 * `LanguageModel` session seeded with the full history and is destroyed after the
 * turn, so there is no per-session lock to get wedged (unlike WebLLM).
 */
export class PromptApiAdapter implements AiAdapter {
  readonly id = 'prompt-api' as const;
  private readonly getApi: () => NormalizedPromptApi | null;
  private downloadProgress: number | null = null;

  constructor(options: PromptApiAdapterOptions = {}) {
    this.getApi = options.getApi ?? (() => getPromptApi());
  }

  async isAvailable(): Promise<boolean> {
    const api = this.getApi();
    if (!api) return false;
    const availability = await api.availability().catch(() => 'unavailable' as const);
    return availability !== 'unavailable';
  }

  async listModels(): Promise<AiModel[]> {
    const api = this.getApi();
    if (!api) return [];
    let availability: Awaited<ReturnType<NormalizedPromptApi['availability']>>;
    try {
      availability = await api.availability();
    } catch {
      return [];
    }
    if (availability === 'unavailable') return [];
    const status: AiModelStatus =
      availability === 'available'
        ? 'ready'
        : availability === 'downloading'
          ? 'downloading'
          : 'downloadable';
    return [
      {
        id: PROMPT_API_MODEL_ID,
        name: 'Chrome built-in (Gemini Nano)',
        provider: 'prompt-api',
        status,
        description: 'Built-in browser model (Chrome Prompt API)',
      },
    ];
  }

  async load(_modelId: string, _signal?: AbortSignal): Promise<void> {
    // Sessions are created per prompt; nothing to warm.
  }

  getDownloadProgress(_modelId: string): number | null {
    return this.downloadProgress;
  }

  async download(
    _modelId: string,
    options?: { signal?: AbortSignal; onProgress?: (progress: number) => void },
  ): Promise<void> {
    const api = this.getApi();
    if (!api) {
      throw new Error('The Chrome built-in Prompt API is not available in this browser.');
    }
    const availability = await api.availability();
    if (availability === 'available') {
      options?.onProgress?.(1);
      return;
    }
    // Creating a session with a monitor warms the built-in model. Chrome may or
    // may not fire transferable downloadprogress events — callers should treat
    // missing/zero progress as indeterminate setup, not a stuck 0% download.
    this.downloadProgress = null;
    try {
      const session = await api.create({
        signal: options?.signal,
        monitor: (monitor) => {
          monitor.addEventListener('downloadprogress', (event) => {
            const ratio = typeof event.loaded === 'number' ? event.loaded : 0;
            // Ignore 0 — that is what produced a stuck “0%” Install bar in Settings.
            if (ratio > 0) {
              this.downloadProgress = ratio;
              options?.onProgress?.(ratio);
            }
          });
        },
      });
      session.destroy?.();
      options?.onProgress?.(1);
    } finally {
      this.downloadProgress = null;
    }
  }

  async prompt(options: AiPromptOptions): Promise<string> {
    const { session, latest } = await this.openSession(options);
    try {
      return await session.prompt(latest, { signal: options.signal });
    } finally {
      session.destroy?.();
    }
  }

  async *promptStreaming(options: AiPromptOptions): AsyncIterable<AiStreamChunk> {
    const { session, latest } = await this.openSession(options);
    try {
      const stream = session.promptStreaming(latest, { signal: options.signal });
      let acc = '';
      for await (const piece of toAsyncIterable(stream)) {
        if (options.signal?.aborted) {
          throw new DOMException('Prompt aborted', 'AbortError');
        }
        const text = typeof piece === 'string' ? piece : String(piece ?? '');
        // Chrome has shipped both cumulative and delta chunk semantics; normalize
        // to deltas so callers always receive incremental text.
        let delta = text;
        if (text.startsWith(acc)) {
          delta = text.slice(acc.length);
          acc = text;
        } else {
          acc += text;
        }
        if (delta) {
          yield { text: delta, done: false };
        }
      }
      yield { text: '', done: true };
    } finally {
      session.destroy?.();
    }
  }

  async unload(_modelId?: string): Promise<void> {
    // No persistent engine; sessions are per-prompt.
  }

  async resetConversation(_modelId?: string, _sessionId?: string): Promise<void> {
    // Stateless: a fresh session is created for each prompt, so there is nothing
    // to clear between LanguageModel conversations.
  }

  private async openSession(
    options: AiPromptOptions,
  ): Promise<{ session: PromptApiSession; latest: string }> {
    const api = this.getApi();
    if (!api) {
      throw new Error('The Chrome built-in Prompt API is not available in this browser.');
    }
    const messages = buildPromptMessages(options);
    const latest = messages[messages.length - 1]?.content ?? options.prompt;
    const initialPrompts = messages.slice(0, -1);
    const session = await api.create({
      signal: options.signal,
      initialPrompts: initialPrompts.length > 0 ? initialPrompts : undefined,
    });
    return { session, latest };
  }
}

function buildPromptMessages(options: AiPromptOptions): PromptMessage[] {
  if (options.messages && options.messages.length > 0) {
    return options.messages;
  }
  const messages: PromptMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.prompt });
  return messages;
}

async function* toAsyncIterable(
  stream: ReadableStream<string> | AsyncIterable<string>,
): AsyncIterable<string> {
  if (stream && typeof (stream as AsyncIterable<string>)[Symbol.asyncIterator] === 'function') {
    yield* stream as AsyncIterable<string>;
    return;
  }
  const reader = (stream as ReadableStream<string>).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value !== undefined) yield value as string;
    }
  } finally {
    reader.releaseLock?.();
  }
}
