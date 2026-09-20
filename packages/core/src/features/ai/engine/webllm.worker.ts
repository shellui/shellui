/**
 * Dedicated Web Worker entry for `@mlc-ai/web-llm`.
 * The shell main thread talks to this via `CreateWebWorkerMLCEngine`.
 *
 * Failures here often never show on the **page** console — check DevTools →
 * the worker target, or rely on main-thread `[shellui.ai]` logs / Install toast.
 */
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();

function logWorker(context: string, error: unknown): void {
  // eslint-disable-next-line no-console -- worker-side diagnostics (easy to miss in page console)
  console.error('[shellui.ai.worker]', context, error);
}

self.addEventListener('error', (event) => {
  logWorker('uncaught', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  });
});

self.addEventListener('unhandledrejection', (event) => {
  logWorker('unhandledrejection', event.reason);
});

self.onmessage = (event: MessageEvent) => {
  try {
    handler.onmessage(event);
  } catch (error) {
    logWorker('onmessage', error);
    // Best-effort: surface to the main-thread client (WebLLM expects kind/uuid/content).
    const uuid =
      event?.data && typeof event.data === 'object' && 'uuid' in event.data
        ? String((event.data as { uuid: unknown }).uuid)
        : '';
    try {
      self.postMessage({
        kind: 'throw',
        uuid,
        content: error instanceof Error ? error.toString() : String(error),
      });
    } catch (postError) {
      logWorker('postMessage(throw)', postError);
    }
  }
};
