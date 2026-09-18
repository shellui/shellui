import { OllamaAdapter, type OllamaAdapterOptions } from './adapters/ollama.js';
import { WebLLMAdapter } from './adapters/webllm.js';
import { AiRegistry } from './registry.js';
import { DEFAULT_OLLAMA_BASE_URL } from './status.js';

export type CreateDefaultAiRegistryOptions = {
  ollama?: OllamaAdapterOptions;
  /** When false, skip registering the WebLLM stub (tests). Default true. */
  includeWebLLM?: boolean;
  defaultModelId?: string | null;
  /** Inject a WebLLM adapter (Settings keeps one instance for download progress). */
  webllmAdapter?: WebLLMAdapter;
};

let sharedWebLLMAdapter: WebLLMAdapter | null = null;

/** Shared browser adapter so Settings download progress survives remounts. */
export function getSharedWebLLMAdapter(): WebLLMAdapter {
  if (!sharedWebLLMAdapter) {
    sharedWebLLMAdapter = new WebLLMAdapter();
  }
  return sharedWebLLMAdapter;
}

/** Shell entry: Ollama + WebLLM stub behind one registry. */
export function createDefaultAiRegistry(options: CreateDefaultAiRegistryOptions = {}): AiRegistry {
  const adapters = [
    new OllamaAdapter(options.ollama ?? { baseUrl: DEFAULT_OLLAMA_BASE_URL }),
    ...(options.includeWebLLM === false ? [] : [options.webllmAdapter ?? getSharedWebLLMAdapter()]),
  ];
  return new AiRegistry({
    adapters,
    defaultModelId: options.defaultModelId ?? null,
  });
}

export type {
  AiAdapter,
  AiAvailability,
  AiModel,
  AiModelStatus,
  AiPromptOptions,
  AiProviderId,
  AiRegistryOptions,
  AiRuntimeStatus,
  AiStreamChunk,
} from './types.js';

export { AiRegistry } from './registry.js';
export { OllamaAdapter } from './adapters/ollama.js';
export type { OllamaAdapterOptions } from './adapters/ollama.js';
export { WebLLMAdapter } from './adapters/webllm.js';
export { BROWSER_MODEL_CATALOG } from './catalog.js';
export {
  DEFAULT_OLLAMA_BASE_URL,
  probeOllama,
  probeWebGpu,
  type ProbeOllamaOptions,
} from './status.js';
