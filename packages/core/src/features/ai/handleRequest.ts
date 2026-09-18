import type { AiRequestPayload, AiResponsePayload, AiStreamPayload, Settings } from '@shellui/sdk';
import { createDefaultAiRegistry } from './createRegistry.js';
import { DEFAULT_OLLAMA_BASE_URL, probeOllama, probeWebGpu } from './status.js';
import type { AiRegistry } from './registry.js';

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type AiSession = {
  id: string;
  modelId: string;
  systemPrompt?: string;
  abortController: AbortController;
};

export type AiHandlerContext = {
  registry: AiRegistry;
  sessions: Map<string, AiSession>;
  getSettings: () => Settings;
};

function replyOk(id: string, data: unknown): AiResponsePayload {
  return { id, data };
}

function replyErr(id: string, message: string, code?: string): AiResponsePayload {
  return { id, error: { message, code } };
}

function isAiEnabled(settings: Settings): boolean {
  return settings.ai?.enabled !== false;
}

function filterModelsBySettings<T extends { provider: string }>(
  models: T[],
  settings: Settings,
): T[] {
  const ollamaEnabled = settings.ai?.ollamaEnabled !== false;
  const browserEnabled = settings.ai?.browserEnabled !== false;
  return models.filter((model) => {
    if (model.provider === 'ollama') return ollamaEnabled;
    if (model.provider === 'webllm') return browserEnabled;
    return true;
  });
}

export function createShellAiRegistry(settings: Settings): AiRegistry {
  return createDefaultAiRegistry({
    ollama: {
      baseUrl: settings.ai?.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL,
    },
    includeWebLLM: settings.ai?.browserEnabled !== false,
    defaultModelId: settings.ai?.defaultModelId ?? null,
  });
}

export type AiHandleResult = {
  response: AiResponsePayload;
  /** Streaming chunks to emit before/after response (promptStreaming). */
  stream?: AsyncIterable<AiStreamPayload>;
};

/**
 * Pure request handler used by AiBridge (and unit tests).
 */
export async function handleAiRequest(
  ctx: AiHandlerContext,
  payload: AiRequestPayload,
): Promise<AiHandleResult> {
  const settings = ctx.getSettings();
  const { id, op } = payload;

  if (!id || !op) {
    return { response: replyErr(id || 'unknown', 'Invalid AI request', 'invalid_request') };
  }

  try {
    switch (op) {
      case 'status': {
        const [webGpu, ollama, models] = await Promise.all([
          probeWebGpu(),
          probeOllama({
            baseUrl: settings.ai?.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL,
          }),
          ctx.registry.listModels(),
        ]);
        return {
          response: replyOk(id, {
            webGpu,
            ollama,
            models: filterModelsBySettings(models, settings),
            defaultModelId: settings.ai?.defaultModelId ?? null,
            enabled: isAiEnabled(settings),
          }),
        };
      }

      case 'listModels': {
        const models = filterModelsBySettings(await ctx.registry.listModels(), settings);
        return { response: replyOk(id, models) };
      }

      case 'availability': {
        if (!isAiEnabled(settings)) {
          return { response: replyOk(id, { availability: 'unavailable' }) };
        }
        const models = filterModelsBySettings(await ctx.registry.listModels(), settings);
        const ready = models.some((m) => m.status === 'ready');
        const downloadable = models.some(
          (m) => m.status === 'downloadable' || m.status === 'needs-webgpu',
        );
        const availability = ready ? 'available' : downloadable ? 'downloadable' : 'unavailable';
        return { response: replyOk(id, { availability }) };
      }

      case 'create': {
        if (!isAiEnabled(settings)) {
          return {
            response: replyErr(id, 'AI is disabled in Settings → AI', 'ai_disabled'),
          };
        }
        ctx.registry.setDefaultModelId(settings.ai?.defaultModelId ?? null);
        const models = filterModelsBySettings(await ctx.registry.listModels(), settings).filter(
          (m) => m.status === 'ready',
        );
        const preferred = payload.model ?? settings.ai?.defaultModelId ?? null;
        const pick =
          (preferred && models.find((m) => m.id === preferred)) ||
          (settings.ai?.defaultModelId &&
            models.find((m) => m.id === settings.ai?.defaultModelId)) ||
          models[0];
        if (!pick) {
          return {
            response: replyErr(
              id,
              'No ready model. Install Ollama or download a browser model in Settings → AI.',
              'no_model',
            ),
          };
        }
        const systemPrompt = payload.initialPrompts
          ?.filter((p) => p.role === 'system')
          .map((p) => p.content)
          .join('\n');
        const session: AiSession = {
          id: createSessionId(),
          modelId: pick.id,
          systemPrompt: systemPrompt || undefined,
          abortController: new AbortController(),
        };
        ctx.sessions.set(session.id, session);
        return {
          response: replyOk(id, { sessionId: session.id, model: session.modelId }),
        };
      }

      case 'prompt': {
        const session = payload.sessionId ? ctx.sessions.get(payload.sessionId) : undefined;
        if (!session) {
          return { response: replyErr(id, 'Unknown AI session', 'invalid_session') };
        }
        if (!payload.prompt) {
          return { response: replyErr(id, 'Missing prompt', 'invalid_request') };
        }
        const text = await ctx.registry.prompt({
          modelId: session.modelId,
          prompt: payload.prompt,
          systemPrompt: session.systemPrompt,
          signal: session.abortController.signal,
        });
        return { response: replyOk(id, { text }) };
      }

      case 'promptStreaming': {
        const session = payload.sessionId ? ctx.sessions.get(payload.sessionId) : undefined;
        if (!session) {
          return { response: replyErr(id, 'Unknown AI session', 'invalid_session') };
        }
        if (!payload.prompt) {
          return { response: replyErr(id, 'Missing prompt', 'invalid_request') };
        }

        const iterable = ctx.registry.promptStreaming({
          modelId: session.modelId,
          prompt: payload.prompt,
          systemPrompt: session.systemPrompt,
          signal: session.abortController.signal,
        });

        async function* mapStream(): AsyncIterable<AiStreamPayload> {
          try {
            for await (const chunk of iterable) {
              yield {
                id,
                chunk: chunk.text,
                done: chunk.done,
              };
            }
            yield { id, chunk: '', done: true };
          } catch (error) {
            yield {
              id,
              done: true,
              error: {
                message: error instanceof Error ? error.message : 'Stream failed',
              },
            };
          }
        }

        return {
          response: replyOk(id, { started: true }),
          stream: mapStream(),
        };
      }

      case 'abort': {
        const session = payload.sessionId ? ctx.sessions.get(payload.sessionId) : undefined;
        session?.abortController.abort();
        return { response: replyOk(id, { aborted: true }) };
      }

      case 'destroy': {
        const session = payload.sessionId ? ctx.sessions.get(payload.sessionId) : undefined;
        if (session) {
          session.abortController.abort();
          ctx.sessions.delete(session.id);
        }
        return { response: replyOk(id, { destroyed: true }) };
      }

      default:
        return { response: replyErr(id, `Unknown AI op: ${op}`, 'unknown_op') };
    }
  } catch (error) {
    return {
      response: replyErr(id, error instanceof Error ? error.message : 'AI request failed'),
    };
  }
}
