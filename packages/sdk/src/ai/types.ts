/**
 * AI postMessage protocol (iframe SDK ↔ shell).
 * Keep payloads JSON-serializable; no engine imports here.
 */

export type AiAvailabilityValue = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export type AiProviderId = 'ollama' | 'webllm';

export type AiModelStatus =
  | 'ready'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'needs-webgpu';

export type AiModelInfo = {
  id: string;
  name: string;
  provider: AiProviderId;
  sizeBytes?: number;
  status: AiModelStatus;
  description?: string;
};

export type AiStatusSnapshot = {
  webGpu: { available: boolean; detail?: string };
  ollama: { reachable: boolean; baseUrl: string; detail?: string };
  models: AiModelInfo[];
  defaultModelId: string | null;
  enabled: boolean;
};

export type LanguageModelCreateOptions = {
  /** Qualified model id (`ollama:llama3.2`). Defaults to shell default. */
  model?: string;
  initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  signal?: AbortSignal;
};

export type AiOp =
  | 'availability'
  | 'create'
  | 'prompt'
  | 'promptStreaming'
  | 'abort'
  | 'destroy'
  | 'listModels'
  | 'status';

export type AiRequestPayload = {
  id: string;
  op: AiOp;
  sessionId?: string;
  model?: string;
  prompt?: string;
  initialPrompts?: LanguageModelCreateOptions['initialPrompts'];
};

export type AiErrorPayload = {
  message: string;
  code?: string;
  status?: number;
};

export type AiResponsePayload = {
  id: string;
  data?: unknown;
  error?: AiErrorPayload;
};

export type AiStreamPayload = {
  id: string;
  chunk?: string;
  done?: boolean;
  error?: AiErrorPayload;
};

export type AiCreateResult = {
  sessionId: string;
  model: string;
};

export type AiAvailabilityResult = {
  availability: AiAvailabilityValue;
};
