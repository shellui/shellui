/**
 * Shared AI types for shell-side adapters and registry.
 * SDK protocol payloads live in `@shellui/sdk` so iframes never import this package.
 */

export type AiProviderId = 'ollama' | 'webllm';

export type AiModelStatus =
  | 'ready'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'needs-webgpu';

export type AiModel = {
  id: string;
  name: string;
  provider: AiProviderId;
  /** Approximate size in bytes when known (catalog / Ollama). */
  sizeBytes?: number;
  status: AiModelStatus;
  /** Short human label (e.g. quant, parameter count). */
  description?: string;
};

export type AiPromptOptions = {
  modelId: string;
  prompt: string;
  signal?: AbortSignal;
  systemPrompt?: string;
};

export type AiStreamChunk = {
  text: string;
  done: boolean;
};

export type AiAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export type AiRuntimeStatus = {
  webGpu: {
    available: boolean;
    detail?: string;
  };
  ollama: {
    reachable: boolean;
    baseUrl: string;
    detail?: string;
  };
  models: AiModel[];
  defaultModelId: string | null;
};

export type AiAdapter = {
  readonly id: AiProviderId;
  /** Soft probe — never throws. */
  isAvailable(): Promise<boolean>;
  listModels(): Promise<AiModel[]>;
  /** Prepare weights / connection for a model id. Idempotent. */
  load(modelId: string, signal?: AbortSignal): Promise<void>;
  prompt(options: AiPromptOptions): Promise<string>;
  promptStreaming(options: AiPromptOptions): AsyncIterable<AiStreamChunk>;
  unload(modelId?: string): Promise<void>;
};

export type AiRegistryOptions = {
  adapters: AiAdapter[];
  defaultModelId?: string | null;
};
