import { OllamaAdapter, type OllamaAdapterOptions } from './adapters/ollama.js';
import { WebLLMAdapter } from './adapters/webllm.js';
import { PromptApiAdapter } from './adapters/promptApi.js';
import { AiRegistry } from './registry.js';
import { DEFAULT_OLLAMA_BASE_URL } from './status.js';

export type CreateDefaultAiRegistryOptions = {
  ollama?: OllamaAdapterOptions;
  /** When false, skip registering the WebLLM adapter (tests). Default true. */
  includeWebLLM?: boolean;
  /** When false, skip registering the Chrome Prompt API adapter (tests). Default true. */
  includePromptApi?: boolean;
  defaultModelId?: string | null;
  /** Inject a WebLLM adapter (Settings keeps one instance for download progress). */
  webllmAdapter?: WebLLMAdapter;
  /** Inject a Prompt API adapter (Settings keeps one instance for download progress). */
  promptApiAdapter?: PromptApiAdapter;
};

let sharedWebLLMAdapter: WebLLMAdapter | null = null;
let sharedPromptApiAdapter: PromptApiAdapter | null = null;

/** Shared browser adapter so Settings download progress survives remounts. */
export function getSharedWebLLMAdapter(): WebLLMAdapter {
  if (!sharedWebLLMAdapter) {
    sharedWebLLMAdapter = new WebLLMAdapter();
  }
  return sharedWebLLMAdapter;
}

/** Shared Prompt API adapter so Settings built-in-model download progress persists. */
export function getSharedPromptApiAdapter(): PromptApiAdapter {
  if (!sharedPromptApiAdapter) {
    sharedPromptApiAdapter = new PromptApiAdapter();
  }
  return sharedPromptApiAdapter;
}

/**
 * Shell entry: Ollama + WebLLM + Chrome Prompt API behind one registry.
 *
 * The Prompt API adapter is always registered but self-hides: its `listModels`
 * returns `[]` unless the Chrome `LanguageModel` global is present and usable.
 */
export function createDefaultAiRegistry(options: CreateDefaultAiRegistryOptions = {}): AiRegistry {
  const adapters = [
    new OllamaAdapter(options.ollama ?? { baseUrl: DEFAULT_OLLAMA_BASE_URL }),
    ...(options.includeWebLLM === false ? [] : [options.webllmAdapter ?? getSharedWebLLMAdapter()]),
    ...(options.includePromptApi === false
      ? []
      : [options.promptApiAdapter ?? getSharedPromptApiAdapter()]),
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
export { PromptApiAdapter, PROMPT_API_MODEL_ID } from './adapters/promptApi.js';
export { getPromptApi, isPromptApiPresent } from './promptApiSupport.js';
export { BROWSER_MODEL_CATALOG } from './catalog.js';
export {
  DEFAULT_OLLAMA_BASE_URL,
  probeOllama,
  probeWebGpu,
  type ProbeOllamaOptions,
} from './status.js';
