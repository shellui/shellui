import type {
  AiAdapter,
  AiModel,
  AiPromptOptions,
  AiRegistryOptions,
  AiStreamChunk,
} from './types.js';

/**
 * Multiplexes registered adapters. Apps never see this — only the shell bridge.
 */
export class AiRegistry {
  private readonly adapters: Map<string, AiAdapter>;
  private defaultModelId: string | null;

  constructor(options: AiRegistryOptions) {
    this.adapters = new Map(options.adapters.map((adapter) => [adapter.id, adapter]));
    this.defaultModelId = options.defaultModelId ?? null;
  }

  getAdapter(providerId: string): AiAdapter | undefined {
    return this.adapters.get(providerId);
  }

  listAdapters(): AiAdapter[] {
    return [...this.adapters.values()];
  }

  setDefaultModelId(modelId: string | null): void {
    this.defaultModelId = modelId;
  }

  getDefaultModelId(): string | null {
    return this.defaultModelId;
  }

  async listModels(): Promise<AiModel[]> {
    const lists = await Promise.all(this.listAdapters().map((adapter) => adapter.listModels()));
    return lists.flat();
  }

  /**
   * Resolve `provider:name` ids (e.g. `ollama:llama3.2`) or bare ids unique across adapters.
   */
  resolveModel(modelId: string): { adapter: AiAdapter; modelId: string } | null {
    const colon = modelId.indexOf(':');
    if (colon > 0) {
      const provider = modelId.slice(0, colon);
      const localId = modelId.slice(colon + 1);
      const adapter = this.adapters.get(provider);
      if (!adapter || !localId) return null;
      return { adapter, modelId: localId };
    }

    // Bare id: prefer default adapter order — first match wins when listing later.
    for (const adapter of this.listAdapters()) {
      // Caller may pass a fully-qualified id already; bare ids are rare.
      if (modelId.startsWith(`${adapter.id}:`)) {
        return { adapter, modelId: modelId.slice(adapter.id.length + 1) };
      }
    }
    return null;
  }

  async resolveReadyModel(preferredId?: string | null): Promise<{
    adapter: AiAdapter;
    modelId: string;
    qualifiedId: string;
  } | null> {
    const models = await this.listModels();
    const ready = models.filter((model) => model.status === 'ready');
    if (ready.length === 0) return null;

    const pick =
      (preferredId && ready.find((model) => model.id === preferredId)) ||
      (this.defaultModelId && ready.find((model) => model.id === this.defaultModelId)) ||
      ready[0];

    if (!pick) return null;

    const resolved = this.resolveModel(pick.id);
    if (!resolved) return null;
    return {
      adapter: resolved.adapter,
      modelId: resolved.modelId,
      qualifiedId: pick.id,
    };
  }

  async prompt(options: AiPromptOptions): Promise<string> {
    const resolved = this.resolveModel(options.modelId);
    if (!resolved) {
      throw new Error(`Unknown model: ${options.modelId}`);
    }
    await resolved.adapter.load(resolved.modelId, options.signal);
    return resolved.adapter.prompt({ ...options, modelId: resolved.modelId });
  }

  promptStreaming(options: AiPromptOptions): AsyncIterable<AiStreamChunk> {
    const resolved = this.resolveModel(options.modelId);
    if (!resolved) {
      throw new Error(`Unknown model: ${options.modelId}`);
    }
    const adapter = resolved.adapter;
    const modelId = resolved.modelId;
    return (async function* () {
      await adapter.load(modelId, options.signal);
      yield* adapter.promptStreaming({ ...options, modelId });
    })();
  }
}
