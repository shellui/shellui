import { generateUuid } from '../utils/uuid.js';
import type { ShellUIMessage } from '../types.js';
import type { AiRequestPayload, AiResponsePayload, AiStreamPayload } from './types.js';

export const AI_REQUEST_TIMEOUT_MS = 180_000;

export type AiMessageSdk = {
  addMessageListener: (
    messageType: string,
    listener: (messageData: ShellUIMessage, originalEvent: MessageEvent) => void,
  ) => () => void;
};

function postAiMessage(message: { type: string; payload: unknown }): void {
  if (typeof window === 'undefined') return;
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
    return;
  }
  window.postMessage(message, '*');
}

export type AiTransport = {
  request: <T>(payload: Omit<AiRequestPayload, 'id'>) => Promise<T>;
  stream: (
    payload: Omit<AiRequestPayload, 'id'>,
    onChunk: (chunk: string) => void,
  ) => Promise<void>;
};

export function createAiPostMessageTransport(
  sdk: AiMessageSdk,
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): AiTransport {
  return {
    request: <T>(payload: Omit<AiRequestPayload, 'id'>): Promise<T> => {
      if (typeof window === 'undefined') {
        return Promise.reject(new Error('Window is undefined'));
      }

      const id = generateUuid();
      return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          cleanup();
          reject(new Error('AI request timed out'));
        }, timeoutMs);

        const cleanup = sdk.addMessageListener('SHELLUI_AI_RESPONSE', (message) => {
          const response = message.payload as AiResponsePayload | undefined;
          if (!response || response.id !== id) return;
          window.clearTimeout(timeoutId);
          cleanup();
          if (response.error) {
            reject(new Error(response.error.message));
            return;
          }
          resolve(response.data as T);
        });

        postAiMessage({
          type: 'SHELLUI_AI_REQUEST',
          payload: { id, ...payload } satisfies AiRequestPayload,
        });
      });
    },

    stream: (payload, onChunk): Promise<void> => {
      if (typeof window === 'undefined') {
        return Promise.reject(new Error('Window is undefined'));
      }

      const id = generateUuid();
      return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          cleanupResponse();
          cleanupStream();
          reject(new Error('AI stream timed out'));
        }, timeoutMs);

        const finish = (error?: Error) => {
          window.clearTimeout(timeoutId);
          cleanupResponse();
          cleanupStream();
          if (error) reject(error);
          else resolve();
        };

        const cleanupResponse = sdk.addMessageListener('SHELLUI_AI_RESPONSE', (message) => {
          const response = message.payload as AiResponsePayload | undefined;
          if (!response || response.id !== id) return;
          if (response.error) {
            finish(new Error(response.error.message));
          }
          // Successful response may arrive after stream done; ignore empty acks.
        });

        const cleanupStream = sdk.addMessageListener('SHELLUI_AI_STREAM', (message) => {
          const stream = message.payload as AiStreamPayload | undefined;
          if (!stream || stream.id !== id) return;
          if (stream.error) {
            finish(new Error(stream.error.message));
            return;
          }
          if (stream.chunk) onChunk(stream.chunk);
          if (stream.done) finish();
        });

        postAiMessage({
          type: 'SHELLUI_AI_REQUEST',
          payload: { id, ...payload } satisfies AiRequestPayload,
        });
      });
    },
  };
}
