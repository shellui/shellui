/**
 * Shared AI types for shell-side adapters and registry (core feature module).
 * SDK protocol payloads live in `@shellui/sdk` so iframes never import these types.
 */

export type AiProviderId = 'ollama' | 'webllm' | 'prompt-api';

export type AiModelStatus =
  | 'ready'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'needs-webgpu'
  /** Browser present but WebLLM runtime unsupported (e.g. Firefox). */
  | 'unsupported';

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
  /**
   * Full chat history for this turn (including the latest user message).
   * When set, adapters that support multi-turn (WebLLM) should prefer this
   * over building `[system?, user: prompt]` alone.
   */
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  /**
   * Owning LanguageModel session id. Stateful adapters (WebLLM) fully dispose and
   * recreate the worker engine when this changes so a new conversation never
   * inherits the previous conversation's KV/chat state (or a stuck generation lock).
   */
  sessionId?: string;
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
    /** Round-trip time for the soft probe when reachable (or until failure). */
    latencyMs?: number;
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
  /**
   * Clear adapter-owned conversation state (e.g. WebLLM chat/KV). WebLLM disposes the
   * whole worker (weights persist in the browser cache and reload fast). Optional —
   * Ollama is a no-op. Called on LanguageModel session destroy/create. `sessionId`
   * (when provided, from `create`) becomes the new owning session.
   */
  resetConversation?(modelId?: string, sessionId?: string): Promise<void>;
  /** Optional browser/catalog download with 0–1 progress. */
  download?(
    modelId: string,
    options?: { signal?: AbortSignal; onProgress?: (progress: number) => void },
  ): Promise<void>;
  cancelDownload?(modelId: string): void;
  deleteInstalled?(modelId: string): Promise<void>;
  getDownloadProgress?(modelId: string): number | null;
};

export type AiRegistryOptions = {
  adapters: AiAdapter[];
  defaultModelId?: string | null;
};
