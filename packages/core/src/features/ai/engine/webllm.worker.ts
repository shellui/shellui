/**
 * Dedicated Web Worker entry for `@mlc-ai/web-llm`.
 * The shell main thread talks to this via `CreateWebWorkerMLCEngine`.
 */
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (event: MessageEvent) => {
  handler.onmessage(event);
};
