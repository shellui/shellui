import { useEffect } from 'react';
import {
  postShellMessage,
  shellui,
  type AiRequestPayload,
  type ShellUIMessage,
} from '@shellui/sdk';
import { buildAiDisabledResponse } from './aiDisabledResponses';

function reply(message: ShellUIMessage, payload: ReturnType<typeof buildAiDisabledResponse>): void {
  const replyMessage = { type: 'SHELLUI_AI_RESPONSE' as const, payload };
  const from = message.from?.filter(Boolean) as string[] | undefined;
  if (from?.length) {
    shellui.sendMessage({ ...replyMessage, to: from });
    return;
  }
  postShellMessage(replyMessage);
}

/**
 * Lightweight stand-in when `config.ai.enabled === false`.
 * Answers SDK AI requests immediately so apps do not hang waiting for AiBridge,
 * without importing adapters, registry, or `@mlc-ai/web-llm`.
 */
export function AiUnavailableResponder() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) {
      return;
    }

    return shellui.addMessageListener('SHELLUI_AI_REQUEST', (message: ShellUIMessage) => {
      const payload = message.payload as AiRequestPayload | undefined;
      if (!payload?.id || !payload.op) return;
      reply(message, buildAiDisabledResponse(payload));
    });
  }, []);

  return null;
}
