import type { AiRequestPayload, AiResponsePayload } from '@shellui/sdk';

/** Pure responses when `config.ai.enabled === false` (no adapters / WebLLM). */
export function buildAiDisabledResponse(payload: AiRequestPayload): AiResponsePayload {
  const { id, op } = payload;

  if (op === 'availability') {
    return { id, data: { availability: 'unavailable' } };
  }
  if (op === 'listModels') {
    return { id, data: { models: [] } };
  }
  if (op === 'status') {
    return {
      id,
      data: {
        webGpu: { available: false },
        ollama: { reachable: false, baseUrl: '' },
        models: [],
        defaultModelId: null,
      },
    };
  }

  return {
    id,
    error: {
      message: 'On-device AI is disabled in shellui.config (ai.enabled: false).',
      code: 'ai_disabled',
    },
  };
}
