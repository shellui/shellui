import type { Settings } from '@shellui/sdk';
import { createShellAiRegistry, handleAiRequest } from './handleRequest.js';
import type { AiModel } from './types.js';
import { DEFAULT_OLLAMA_BASE_URL, probeOllama, probeWebGpu } from './status.js';

/** Tiny prompt used by Settings → Develop AI buttons. */
export const DEVELOP_AI_TEST_PROMPT = 'Reply with exactly: pong';

export type DevelopAiDiagnostics = {
  webGpuAvailable: boolean;
  webGpuDetail?: string;
  ollamaReachable: boolean;
  ollamaBaseUrl: string;
  ollamaDetail?: string;
  ollamaLatencyMs?: number;
  defaultModelId: string | null;
  adapters: string[];
  models: AiModel[];
  aiEnabled: boolean;
};

export type DevelopAiPromptResult = {
  modelId: string;
  text: string;
};

function nextRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function assertOk<T>(response: { data?: unknown; error?: { message: string } }): T {
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.data as T;
}

/** Diagnostics via the same registry factory and probes the shell uses. */
export async function collectDevelopAiDiagnostics(
  settings: Settings,
): Promise<DevelopAiDiagnostics> {
  const registry = createShellAiRegistry(settings);
  const [webGpu, ollama, models] = await Promise.all([
    probeWebGpu(),
    probeOllama({
      baseUrl: settings.ai?.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL,
    }),
    registry.listModels(),
  ]);

  const ollamaEnabled = settings.ai?.ollamaEnabled !== false;
  const browserEnabled = settings.ai?.browserEnabled !== false;
  const filtered = models.filter((model) => {
    if (model.provider === 'ollama') return ollamaEnabled;
    if (model.provider === 'webllm') return browserEnabled;
    return true;
  });

  return {
    webGpuAvailable: webGpu.available,
    webGpuDetail: webGpu.detail,
    ollamaReachable: ollama.reachable,
    ollamaBaseUrl: ollama.baseUrl,
    ollamaDetail: ollama.detail,
    ollamaLatencyMs: ollama.latencyMs,
    defaultModelId: settings.ai?.defaultModelId ?? registry.getDefaultModelId(),
    adapters: registry.listAdapters().map((adapter) => adapter.id),
    models: filtered,
    aiEnabled: settings.ai?.enabled !== false,
  };
}

/** One-shot prompt through `handleAiRequest` (same path as iframe apps). */
export async function runDevelopAiPrompt(
  settings: Settings,
  prompt: string = DEVELOP_AI_TEST_PROMPT,
): Promise<DevelopAiPromptResult> {
  const registry = createShellAiRegistry(settings);
  const sessions = new Map();
  const ctx = {
    registry,
    sessions,
    getSettings: () => settings,
  };

  const created = await handleAiRequest(ctx, {
    id: nextRequestId('develop-create'),
    op: 'create',
  });
  const session = assertOk<{ sessionId: string; model: string }>(created.response);

  try {
    const prompted = await handleAiRequest(ctx, {
      id: nextRequestId('develop-prompt'),
      op: 'prompt',
      sessionId: session.sessionId,
      prompt,
    });
    const data = assertOk<{ text: string }>(prompted.response);
    return { modelId: session.model, text: data.text };
  } finally {
    await handleAiRequest(ctx, {
      id: nextRequestId('develop-destroy'),
      op: 'destroy',
      sessionId: session.sessionId,
    });
  }
}

/** Streaming prompt through `handleAiRequest`, appending chunks via callback. */
export async function runDevelopAiStream(
  settings: Settings,
  prompt: string,
  onChunk: (chunk: string) => void,
): Promise<DevelopAiPromptResult> {
  const registry = createShellAiRegistry(settings);
  const sessions = new Map();
  const ctx = {
    registry,
    sessions,
    getSettings: () => settings,
  };

  const created = await handleAiRequest(ctx, {
    id: nextRequestId('develop-create'),
    op: 'create',
  });
  const session = assertOk<{ sessionId: string; model: string }>(created.response);

  try {
    const streamed = await handleAiRequest(ctx, {
      id: nextRequestId('develop-stream'),
      op: 'promptStreaming',
      sessionId: session.sessionId,
      prompt,
    });
    assertOk<{ started: boolean }>(streamed.response);

    let text = '';
    if (streamed.stream) {
      for await (const part of streamed.stream) {
        if (part.error) {
          throw new Error(part.error.message);
        }
        if (part.chunk) {
          text += part.chunk;
          onChunk(part.chunk);
        }
      }
    }
    return { modelId: session.model, text };
  } finally {
    await handleAiRequest(ctx, {
      id: nextRequestId('develop-destroy'),
      op: 'destroy',
      sessionId: session.sessionId,
    });
  }
}
