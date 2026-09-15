import { DEFAULT_OLLAMA_BASE_URL, probeOllama } from '../status.js';
import type { AiAdapter, AiModel, AiPromptOptions, AiStreamChunk } from '../types.js';

export type OllamaAdapterOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type OllamaTag = {
  name: string;
  size?: number;
};

type OllamaTagsResponse = {
  models?: OllamaTag[];
};

type OllamaGenerateResponse = {
  response?: string;
  done?: boolean;
};

/**
 * Local Ollama HTTP adapter. Soft-fails when the daemon is down or CORS blocks us.
 */
export class OllamaAdapter implements AiAdapter {
  readonly id = 'ollama' as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: OllamaAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 2_000;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    const status = await probeOllama({
      baseUrl: this.baseUrl,
      fetchImpl: this.fetchImpl,
      timeoutMs: this.timeoutMs,
    });
    return status.reachable;
  }

  async listModels(): Promise<AiModel[]> {
    if (!(await this.isAvailable())) {
      return [];
    }

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/tags`, { method: 'GET' });
      if (!response.ok) return [];
      const body = (await response.json()) as OllamaTagsResponse;
      return (body.models ?? []).map((tag) => ({
        id: `ollama:${tag.name}`,
        name: tag.name,
        provider: 'ollama' as const,
        sizeBytes: tag.size,
        status: 'ready' as const,
        description: 'Local Ollama model',
      }));
    } catch {
      return [];
    }
  }

  async load(_modelId: string, _signal?: AbortSignal): Promise<void> {
    // Ollama loads on first generate; nothing to warm here in v1.
  }

  async prompt(options: AiPromptOptions): Promise<string> {
    const body = {
      model: options.modelId,
      prompt: options.prompt,
      system: options.systemPrompt,
      stream: false,
    };

    const response = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama generate failed with HTTP ${response.status}`);
    }

    const json = (await response.json()) as OllamaGenerateResponse;
    return json.response ?? '';
  }

  async *promptStreaming(options: AiPromptOptions): AsyncIterable<AiStreamChunk> {
    const body = {
      model: options.modelId,
      prompt: options.prompt,
      system: options.systemPrompt,
      stream: true,
    };

    const response = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama stream failed with HTTP ${response.status}`);
    }

    if (!response.body) {
      const text = await this.prompt(options);
      yield { text, done: true };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: OllamaGenerateResponse;
        try {
          parsed = JSON.parse(trimmed) as OllamaGenerateResponse;
        } catch {
          continue;
        }
        const text = parsed.response ?? '';
        if (text || parsed.done) {
          yield { text, done: Boolean(parsed.done) };
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as OllamaGenerateResponse;
        yield { text: parsed.response ?? '', done: Boolean(parsed.done ?? true) };
      } catch {
        // ignore trailing junk
      }
    }
  }

  async unload(_modelId?: string): Promise<void> {
    // No persistent engine process in the browser adapter.
  }
}
