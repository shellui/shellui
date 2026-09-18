import { useEffect, useMemo, useRef } from 'react';
import {
  postShellMessage,
  shellui,
  type AiRequestPayload,
  type AiResponsePayload,
  type AiStreamPayload,
  type ShellUIMessage,
} from '@shellui/sdk';
import { useConfig } from '../config/useConfig';
import { getAiRequestTrustDenial } from '../security/trustedFrames';
import { useSettings } from '../settings/hooks/useSettings';
import { createShellAiRegistry, handleAiRequest, type AiSession } from './handleRequest';

function replyToSender(
  message: ShellUIMessage,
  payload: AiResponsePayload | AiStreamPayload,
  type: 'SHELLUI_AI_RESPONSE' | 'SHELLUI_AI_STREAM',
): void {
  const reply = { type, payload };
  const from = message.from?.filter(Boolean) as string[] | undefined;
  if (from?.length) {
    shellui.sendMessage({ ...reply, to: from });
    return;
  }
  postShellMessage(reply);
}

/**
 * Root-window bridge: iframe `SHELLUI_AI_*` messages are handled here.
 * Adapters/registry live in this core feature module; the SDK only postMessages.
 * Requests use the same privileged + trusted-frame policy as storage.
 */
export const AiBridge = () => {
  const { config } = useConfig();
  const { settings } = useSettings();
  const sessionsRef = useRef(new Map<string, AiSession>());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const registry = useMemo(
    () => createShellAiRegistry(settings),
    // Rebuild when provider toggles / base URL / default change.
    // Listing models / opening Settings must not import @mlc-ai/web-llm —
    // that happens only inside WebLLMEngineService install/load/delete.
    [
      settings.ai?.ollamaBaseUrl,
      settings.ai?.ollamaEnabled,
      settings.ai?.browserEnabled,
      settings.ai?.defaultModelId,
    ],
  );

  useEffect(() => {
    registry.setDefaultModelId(settings.ai?.defaultModelId ?? null);
  }, [registry, settings.ai?.defaultModelId]);

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }

    const listener = (message: ShellUIMessage) => {
      const payload = message.payload as AiRequestPayload | undefined;
      if (!payload?.id || !payload.op) return;

      const trustDenial = getAiRequestTrustDenial(message.from, shellui.frameRegistry, config);
      if (trustDenial) {
        replyToSender(
          message,
          {
            id: payload.id,
            error: { message: trustDenial.message, code: trustDenial.code },
          },
          'SHELLUI_AI_RESPONSE',
        );
        return;
      }

      void handleAiRequest(
        {
          registry,
          sessions: sessionsRef.current,
          getSettings: () => settingsRef.current,
        },
        payload,
      ).then(async (result) => {
        if (result.stream) {
          // Ack start, then stream chunks to the requesting iframe only.
          replyToSender(message, result.response, 'SHELLUI_AI_RESPONSE');
          for await (const chunk of result.stream) {
            replyToSender(message, chunk, 'SHELLUI_AI_STREAM');
          }
          return;
        }
        replyToSender(message, result.response, 'SHELLUI_AI_RESPONSE');
      });
    };

    return shellui.addMessageListener('SHELLUI_AI_REQUEST', listener);
  }, [registry, config]);

  return null;
};
