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
  /** Accumulated multi-turn history (user/assistant; system lives in systemPrompt). */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  abortController: AbortController;
};

export type AiHandlerContext = {
  registry: AiRegistry;
  sessions: Map<string, AiSession>;
  getSettings: () => Settings;
  /**
   * Currently active LanguageModel session. Updated on create; cleared when that
   * session is destroyed. Late destroy of a superseded session must not call
   * resetConversation / interruptGenerate (would kill the new chat’s generation).
   */
  activeSessionId: { current: string | null };
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
        // Claim active before reset so a late destroy of the previous session
        // cannot interrupt this conversation's upcoming generation.
        const sessionId = createSessionId();
        ctx.activeSessionId.current = sessionId;
        try {
          // Pass the new sessionId so the engine hard-resets when switching away
          // from a prior conversation and claims this one (no redundant reload).
          await ctx.registry.resetConversation(pick.id, sessionId);
        } catch (error) {
          // eslint-disable-next-line no-console -- create should still proceed; next prompt may hang otherwise
          console.error('[shellui.ai]', 'resetConversation on create failed', error);
        }
        const systemPrompt = payload.initialPrompts
          ?.filter((p) => p.role === 'system')
          .map((p) => p.content)
          .join('\n');
        const seedMessages =
          payload.initialPrompts
            ?.filter((p) => p.role === 'user' || p.role === 'assistant')
            .map((p) => ({
              role: p.role as 'user' | 'assistant',
              content: p.content,
            })) ?? [];
        const session: AiSession = {
          id: sessionId,
          modelId: pick.id,
          systemPrompt: systemPrompt || undefined,
          messages: seedMessages,
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
        session.messages.push({ role: 'user', content: payload.prompt });
        const messages = buildSessionMessages(session);
        try {
          const text = await ctx.registry.prompt({
            modelId: session.modelId,
            prompt: payload.prompt,
            systemPrompt: session.systemPrompt,
            messages,
            sessionId: session.id,
            signal: session.abortController.signal,
          });
          session.messages.push({ role: 'assistant', content: text });
          return { response: replyOk(id, { text }) };
        } catch (error) {
          // Drop the user turn if generation failed so a retry can re-send cleanly.
          session.messages.pop();
          throw error;
        }
      }

      case 'promptStreaming': {
        const session = payload.sessionId ? ctx.sessions.get(payload.sessionId) : undefined;
        if (!session) {
          return { response: replyErr(id, 'Unknown AI session', 'invalid_session') };
        }
        if (!payload.prompt) {
          return { response: replyErr(id, 'Missing prompt', 'invalid_request') };
        }

        session.messages.push({ role: 'user', content: payload.prompt });
        const messages = buildSessionMessages(session);

        const iterable = ctx.registry.promptStreaming({
          modelId: session.modelId,
          prompt: payload.prompt,
          systemPrompt: session.systemPrompt,
          messages,
          sessionId: session.id,
          signal: session.abortController.signal,
        });

        async function* mapStream(): AsyncIterable<AiStreamPayload> {
          let assistant = '';
          try {
            for await (const chunk of iterable) {
              if (chunk.text) assistant += chunk.text;
              yield {
                id,
                chunk: chunk.text,
                done: chunk.done,
              };
            }
            yield { id, chunk: '', done: true };
            session.messages.push({ role: 'assistant', content: assistant });
          } catch (error) {
            // Drop the pending user turn on failure.
            if (session.messages.at(-1)?.role === 'user') {
              session.messages.pop();
            }
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
          const wasActive = ctx.activeSessionId.current === session.id;
          session.abortController.abort();
          ctx.sessions.delete(session.id);
          if (wasActive) {
            ctx.activeSessionId.current = null;
            // Only the active session may reset/interrupt — a late destroy of a
            // superseded chat must not kill the new conversation's generation.
            try {
              await ctx.registry.resetConversation(session.modelId);
            } catch (error) {
              // eslint-disable-next-line no-console -- destroy still acks; log for operators
              console.error('[shellui.ai]', 'resetConversation on destroy failed', error);
            }
          }
        } else if (payload.sessionId && ctx.activeSessionId.current === payload.sessionId) {
          // Session already gone from map but still marked active.
          ctx.activeSessionId.current = null;
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

function buildSessionMessages(
  session: AiSession,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (session.systemPrompt) {
    messages.push({ role: 'system', content: session.systemPrompt });
  }
  for (const turn of session.messages) {
    messages.push(turn);
  }
  return messages;
}
