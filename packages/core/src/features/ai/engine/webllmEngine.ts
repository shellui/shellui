import type { ChatCompletionChunk, MLCEngineInterface } from '@mlc-ai/web-llm';
import { BROWSER_MODEL_CATALOG } from '../catalog.js';
import {
  isBrowserModelInstalled,
  markBrowserModelInstalled,
  removeBrowserModelInstalled,
} from '../browserInstallStore.js';
import {
  addTransfer,
  completeTransfer,
  failTransfer,
  interruptTransfer,
  isTransferSignalAborted,
  markTransferCancelled,
  setTransferProgress,
} from '../../transfers/transferQueue.js';
import { formatInstallFailureMessage, formatUnknownError, logAiError } from './formatAiError.js';
import { mapInitProgress } from './mapInitProgress.js';
import { mapWebLlmRuntimeError } from '../webLlmBrowserSupport.js';

export type WebLLMModule = typeof import('@mlc-ai/web-llm');

export type WebLLMEngineLike = Pick<
  MLCEngineInterface,
  'chat' | 'unload' | 'reload' | 'setInitProgressCallback'
> & {
  /** Clears an in-flight decode so the next chat.completions.create can start. */
  interruptGenerate?: () => void;
  /**
   * Clears WebLLM chat / KV cache for a fresh conversation without unloading weights.
   * WebWorkerMLCEngine returns a Promise; some doubles may be sync.
   */
  resetChat?: (keepStats?: boolean, modelId?: string) => void | Promise<void>;
  /** Optional terminate for test doubles / worker clients. */
  worker?: Worker;
};

export type LoadWebLLMModule = () => Promise<WebLLMModule>;

export type CreateWorkerFn = () => Worker | Promise<Worker>;

export type WebLLMEngineServiceOptions = {
  loadModule?: LoadWebLLMModule;
  createWorker?: CreateWorkerFn;
  /** When false, skip transfer toaster (tests). Default true. */
  useTransferToast?: boolean;
};

type ActiveInstall = {
  localId: string;
  transferId: string;
  controller: AbortController;
  progress: number;
  progressText?: string;
};

function transferIdFor(localId: string): string {
  return `ai-download:${localId}`;
}

function catalogEntry(localId: string) {
  return BROWSER_MODEL_CATALOG.find((model) => model.id.replace(/^webllm:/, '') === localId);
}

function toLocalId(modelId: string): string {
  return modelId.replace(/^webllm:/, '');
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

const defaultLoadModule: LoadWebLLMModule = async () => {
  const mod = await import('@mlc-ai/web-llm');
  return normalizeWebLlmModule(mod);
};

/**
 * Resolve `@mlc-ai/web-llm` after dynamic import.
 * Vite optimizeDeps / interop can nest named exports under `.default` (or deeper)
 * or drop them from a mangled prebundle — prefer excluding the package from optimizeDeps.
 */
export function normalizeWebLlmModule(mod: unknown): WebLLMModule {
  const candidates: unknown[] = [mod];
  if (mod && typeof mod === 'object') {
    const d1 = (mod as { default?: unknown }).default;
    if (d1) candidates.push(d1);
    if (d1 && typeof d1 === 'object') {
      const d2 = (d1 as { default?: unknown }).default;
      if (d2) candidates.push(d2);
    }
  }

  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof (candidate as { CreateWebWorkerMLCEngine?: unknown }).CreateWebWorkerMLCEngine ===
        'function'
    ) {
      return candidate as WebLLMModule;
    }
  }

  // Last resort: find a function property that looks like the factory (mangled re-exports).
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (
        typeof value === 'function' &&
        /CreateWebWorkerMLCEngine/i.test(key) &&
        key !== 'default'
      ) {
        return candidate as WebLLMModule;
      }
    }
  }

  // Optional v1 escape hatch: main-thread CreateMLCEngine if the worker factory is gone.
  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof (candidate as { CreateMLCEngine?: unknown }).CreateMLCEngine === 'function'
    ) {
      // eslint-disable-next-line no-console -- operator-facing fallback
      console.warn(
        '[shellui.ai]',
        'CreateWebWorkerMLCEngine missing after import; falling back to CreateMLCEngine (main thread). Prefer optimizeDeps.exclude for @mlc-ai/web-llm.',
      );
      const api = candidate as WebLLMModule & {
        CreateMLCEngine: (
          modelId: string | string[],
          engineConfig?: unknown,
          chatOpts?: unknown,
        ) => Promise<unknown>;
      };
      return {
        ...api,
        CreateWebWorkerMLCEngine: async (
          _worker: unknown,
          modelId: string | string[],
          engineConfig?: unknown,
          chatOpts?: unknown,
        ) => api.CreateMLCEngine(modelId, engineConfig, chatOpts),
      } as WebLLMModule;
    }
  }

  const keys = mod && typeof mod === 'object' ? Object.keys(mod as object) : [];
  const defaultKeys =
    mod &&
    typeof mod === 'object' &&
    (mod as { default?: unknown }).default &&
    typeof (mod as { default: unknown }).default === 'object'
      ? Object.keys((mod as { default: object }).default)
      : [];
  // eslint-disable-next-line no-console -- diagnose mangled Vite prebundles
  console.error('[shellui.ai] web-llm import keys', keys, defaultKeys.length ? defaultKeys : null);

  throw new Error(
    'Failed to load @mlc-ai/web-llm: CreateWebWorkerMLCEngine is missing. ' +
      'Exclude @mlc-ai/web-llm from Vite optimizeDeps and clear node_modules/.vite-shellui.',
  );
}

/**
 * Spawn the dedicated worker only at install/load time (never on module import).
 * Prefer Vite's `?worker` constructor (shows a Network request for the worker chunk),
 * then fall back to `new Worker(new URL(..., import.meta.url))`.
 */
async function defaultCreateWorker(): Promise<Worker> {
  let viteWorkerError: unknown;
  try {
    // Vite transforms this to a Worker constructor that fetches a bundled module worker.
    const mod = await import('./webllm.worker.ts?worker&module');
    const WorkerCtor = (mod as { default?: new () => Worker }).default;
    if (typeof WorkerCtor === 'function') {
      return new WorkerCtor();
    }
    viteWorkerError = new Error('Vite worker module did not export a Worker constructor');
  } catch (error) {
    viteWorkerError = error;
  }

  try {
    return new Worker(new URL('./webllm.worker.ts', import.meta.url), {
      type: 'module',
      name: 'shellui-webllm',
    });
  } catch (error) {
    throw new Error(
      `Failed to start WebLLM worker: ${formatUnknownError(error)}. ` +
        `Vite ?worker fallback: ${formatUnknownError(viteWorkerError)}. ` +
        'Check that shell Vite uses worker.format = "es" and can resolve webllm.worker.ts.',
      { cause: error instanceof Error ? error : undefined },
    );
  }
}

/**
 * Shell-owned WebLLM runtime: one warm browser model + in-flight installs.
 * Survives Settings unmount; progress is mirrored into the shared transfer toaster.
 *
 * v1 limit: only one browser model is warm at a time (WebLLM worker reload swaps it).
 */
export class WebLLMEngineService {
  private readonly loadModule: LoadWebLLMModule;
  private readonly createWorker: CreateWorkerFn;
  private readonly useTransferToast: boolean;

  private worker: Worker | null = null;
  private engine: WebLLMEngineLike | null = null;
  private warmModelId: string | null = null;
  private loadPromise: Promise<void> | null = null;
  private loadingModelId: string | null = null;
  private lastInstallError: string | null = null;
  private readonly installs = new Map<string, ActiveInstall>();
  private readonly progressListeners = new Set<(localId: string, progress: number) => void>();
  /** Serializes prompt / promptStreaming on the shared worker (WebLLM holds a generation lock). */
  private generationTail: Promise<void> = Promise.resolve();
  /**
   * LanguageModel session that last generated on the warm engine. When a prompt
   * or reset arrives for a different session we **fully dispose the worker** and
   * recreate a fresh engine (weights come from the WebLLM browser cache) so a new
   * conversation never inherits the previous one's KV/chat state — or, worse, a
   * stuck streaming/generation lock (upstream mlc-ai/web-llm#701, mlc-ai/mlc-llm#3113).
   */
  private servingSessionId: string | null = null;

  constructor(options: WebLLMEngineServiceOptions = {}) {
    this.loadModule = options.loadModule ?? defaultLoadModule;
    this.createWorker = options.createWorker ?? defaultCreateWorker;
    this.useTransferToast = options.useTransferToast !== false;
  }

  getLastInstallError(): string | null {
    return this.lastInstallError;
  }

  subscribeProgress(listener: (localId: string, progress: number) => void): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  getDownloadProgress(modelId: string): number | null {
    const localId = toLocalId(modelId);
    const active = this.installs.get(localId);
    return active ? active.progress : null;
  }

  getDownloadProgressText(modelId: string): string | undefined {
    return this.installs.get(toLocalId(modelId))?.progressText;
  }

  isDownloading(modelId: string): boolean {
    return this.installs.has(toLocalId(modelId));
  }

  getWarmModelId(): string | null {
    return this.warmModelId;
  }

  /**
   * Fetch weights (via WebLLM / HF) + warm the worker engine.
   * Marks the catalog model installed only after the engine can run.
   */
  async install(
    modelId: string,
    options?: { signal?: AbortSignal; onProgress?: (progress: number) => void },
  ): Promise<void> {
    const localId = toLocalId(modelId);
    if (this.warmModelId === localId && this.engine) {
      markBrowserModelInstalled(localId);
      options?.onProgress?.(1);
      return;
    }
    if (this.installs.has(localId)) {
      throw new Error('A download is already in progress for this model.');
    }

    const entry = catalogEntry(localId);
    const transferId = transferIdFor(localId);
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options?.signal?.addEventListener('abort', onAbort, { once: true });

    let toastSignal: AbortSignal | undefined;
    if (this.useTransferToast) {
      const added = addTransfer({
        id: transferId,
        kind: 'download',
        name: entry?.name ?? localId,
        detail: localId,
        size: entry?.sizeBytes ?? 0,
      });
      toastSignal = added.signal;
      toastSignal.addEventListener(
        'abort',
        () => {
          controller.abort();
        },
        { once: true },
      );
    }

    const active: ActiveInstall = {
      localId,
      transferId,
      controller,
      progress: 0,
    };
    this.installs.set(localId, active);

    const report = (ratio: number, text?: string) => {
      active.progress = ratio;
      active.progressText = text;
      options?.onProgress?.(ratio);
      this.progressListeners.forEach((listener) => listener(localId, ratio));
      if (this.useTransferToast) {
        setTransferProgress(transferId, {
          ratio,
          total: entry?.sizeBytes,
        });
      }
    };

    try {
      if (controller.signal.aborted || options?.signal?.aborted) {
        throw new DOMException('Download cancelled', 'AbortError');
      }
      this.lastInstallError = null;
      await this.ensureEngine(localId, {
        signal: controller.signal,
        onProgress: report,
      });
      markBrowserModelInstalled(localId);
      report(1, 'Ready');
      if (this.useTransferToast && !isTransferSignalAborted(transferId, toastSignal)) {
        completeTransfer(transferId);
      }
    } catch (error) {
      const aborted = controller.signal.aborted || isAbortError(error);
      if (aborted) {
        if (this.useTransferToast) {
          markTransferCancelled(transferId);
        }
        throw error instanceof DOMException
          ? error
          : new DOMException('Download cancelled', 'AbortError');
      }
      const mapped = mapWebLlmRuntimeError(error);
      // Keep explicit worker-crash / engine messages; only remap raw WebGPU-ish throws.
      const keepAsIs =
        error instanceof Error &&
        (/^WebLLM worker crashed/i.test(error.message) ||
          /^CreateWebWorkerMLCEngine failed/i.test(error.message) ||
          /^Failed to (load|start) WebLLM/i.test(error.message));
      const beforeModelFetch = !active.progressText && active.progress <= 0;
      const message =
        (!keepAsIs ? mapped : null) ??
        formatInstallFailureMessage(error, {
          progressText: active.progressText,
          beforeModelFetch,
          fallback: 'Model download failed',
        });
      this.lastInstallError = message;
      logAiError('install', error, {
        modelId: localId,
        stage: 'install',
        progressText: active.progressText,
        beforeModelFetch,
      });
      if (this.useTransferToast) {
        failTransfer(transferId, message);
      }
      throw new Error(message, { cause: error instanceof Error ? error : undefined });
    } finally {
      options?.signal?.removeEventListener('abort', onAbort);
      this.installs.delete(localId);
    }
  }

  cancelDownload(modelId: string): void {
    const localId = toLocalId(modelId);
    const active = this.installs.get(localId);
    if (!active) return;
    active.controller.abort();
    if (this.useTransferToast) {
      interruptTransfer(active.transferId);
    }
    void this.disposeWorker();
  }

  async deleteInstalled(modelId: string): Promise<void> {
    const localId = toLocalId(modelId);
    this.cancelDownload(localId);
    if (this.warmModelId === localId) {
      await this.unload(localId);
    }
    removeBrowserModelInstalled(localId);
    try {
      const webllm = await this.loadModule();
      await webllm.deleteModelAllInfoInCache(localId);
    } catch {
      // Best-effort cache wipe for v1.
    }
  }

  /** Ensure the named model is loaded in the worker (uses WebLLM cache when present). */
  async load(modelId: string, signal?: AbortSignal): Promise<void> {
    const localId = toLocalId(modelId);
    if (!isBrowserModelInstalled(localId) && this.warmModelId !== localId) {
      throw new Error(
        `Browser model "${modelId}" is not installed yet. Install it from Settings → AI.`,
      );
    }
    if (this.warmModelId === localId && this.engine) return;
    await this.ensureEngine(localId, {
      signal,
      onProgress: (ratio) => {
        this.progressListeners.forEach((listener) => listener(localId, ratio));
      },
    });
  }

  async prompt(options: {
    modelId: string;
    prompt: string;
    systemPrompt?: string;
    signal?: AbortSignal;
    messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    sessionId?: string;
  }): Promise<string> {
    this.interruptForSessionSwitch(options.sessionId);
    return this.withGenerationLock(async () => {
      const engine = await this.ensureEngineForSession(
        options.modelId,
        options.sessionId,
        options.signal,
      );
      const messages = resolveMessages(options);
      try {
        const response = await engine.chat.completions.create({
          messages,
          stream: false,
        });
        if (options.signal?.aborted) {
          throw new DOMException('Prompt aborted', 'AbortError');
        }
        const choice = response.choices?.[0]?.message?.content;
        return typeof choice === 'string' ? choice : '';
      } finally {
        if (options.signal?.aborted) {
          // Dispose so the next prompt cannot inherit a stuck WebLLM lock.
          await this.disposeEngineAndWorker();
        } else {
          this.clearGeneration(engine, 'prompt');
        }
      }
    });
  }

  async *promptStreaming(options: {
    modelId: string;
    prompt: string;
    systemPrompt?: string;
    signal?: AbortSignal;
    messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    sessionId?: string;
  }): AsyncIterable<{ text: string; done: boolean }> {
    // Break any in-flight (or stuck) generation from a prior conversation BEFORE
    // we queue behind the generation lock, so a switch cannot deadlock.
    this.interruptForSessionSwitch(options.sessionId);
    const release = await this.acquireGenerationLock();
    let engine: WebLLMEngineLike | null = null;
    try {
      engine = await this.ensureEngineForSession(
        options.modelId,
        options.sessionId,
        options.signal,
      );
      const messages = resolveMessages(options);
      const stream = (await engine.chat.completions.create({
        messages,
        stream: true,
        stream_options: { include_usage: false },
      })) as AsyncIterable<ChatCompletionChunk>;

      let finished = false;
      for await (const chunk of stream) {
        if (options.signal?.aborted) {
          // eslint-disable-next-line no-console -- operator-facing interrupt signal
          console.error('[shellui.ai]', 'promptStreaming aborted — interrupting WebLLM generation');
          throw new DOMException('Prompt aborted', 'AbortError');
        }
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        const finish = chunk.choices?.[0]?.finish_reason;
        if (delta && !finished) {
          yield { text: delta, done: false };
        }
        if (finish && !finished) {
          finished = true;
          yield { text: '', done: true };
          // Keep draining the WebLLM async generator so its internal lock clears.
          // Do not return early — abandoning the iterator leaves the next create() hanging.
        }
      }
      if (!finished) {
        yield { text: '', done: true };
      }
    } finally {
      if (options.signal?.aborted) {
        // Stop / abort: fully dispose the worker so the next prompt starts on a
        // fresh engine instead of hitting a possibly-stuck WebLLM streaming lock
        // (upstream mlc-ai/web-llm#701, mlc-ai/mlc-llm#3113). Weights stay cached.
        await this.disposeEngineAndWorker();
      } else if (engine) {
        this.clearGeneration(engine, 'promptStreaming');
      }
      release();
    }
  }

  async unload(modelId?: string): Promise<void> {
    const localId = modelId ? toLocalId(modelId) : this.warmModelId;
    if (localId && this.warmModelId && localId !== this.warmModelId) return;
    try {
      await this.engine?.unload();
    } catch {
      // ignore
    }
    await this.disposeWorker();
    this.engine = null;
    this.warmModelId = null;
    this.servingSessionId = null;
  }

  /**
   * Prepare for a new LanguageModel conversation (called on `create` / `destroy`).
   *
   * WebLLM's worker engine keeps chat + KV cache state between `chat.completions.create`
   * calls and holds a per-model generation lock that only releases when the previous
   * async stream fully drains. Ollama has none of this (each HTTP generate is
   * independent), which is why only WebLLM hangs on conversation switch.
   *
   * Soft `resetChat` and even `reload` on the *living* worker proved unreliable in
   * the field: an upstream streaming-lock bug (mlc-ai/web-llm#701 — the model lock
   * is not always released after a streamed completion — and mlc-ai/mlc-llm#3113 —
   * `interruptGenerate` can leave `interruptSignal`/the lock stuck) means the worker
   * can stay wedged and the next `create()` hangs forever. `@mlc-ai/web-llm@0.2.85`
   * (our pinned version) still ships this class of bug (#701 is not merged).
   *
   * The reliable v1 fix is **nuclear**: fully dispose the worker (terminate) so the
   * stuck lock dies with it, then let the next prompt recreate a fresh engine —
   * weights are served from the WebLLM browser cache (short warm, not a full HF
   * re-download). We do NOT await `engine.unload()` because a wedged worker may
   * never ack; `terminate()` forcibly kills it.
   *
   * `sessionId` (from `create`) becomes the engine's owning session so the first
   * prompt of that session does not redundantly recreate again.
   */
  async resetConversation(_modelId?: string, sessionId?: string): Promise<void> {
    // Eager interrupt BEFORE queuing behind the lock so a stuck stream unblocks.
    this.safeInterrupt('resetConversation');
    await this.withGenerationLock(async () => {
      if (this.engine) {
        await this.disposeEngineAndWorker();
      }
      this.servingSessionId = sessionId ?? null;
    });
  }

  /** Fire interruptGenerate on the warm engine, swallowing errors. */
  private safeInterrupt(context: string): void {
    try {
      this.engine?.interruptGenerate?.();
    } catch (error) {
      // eslint-disable-next-line no-console -- interrupt failures are easy to miss otherwise
      console.error('[shellui.ai]', `interruptGenerate (${context}) failed`, error);
    }
  }

  /** Eager (pre-lock) interrupt when a prompt targets a different session than the warm one. */
  private interruptForSessionSwitch(sessionId?: string): void {
    if (sessionId && this.servingSessionId !== null && sessionId !== this.servingSessionId) {
      this.safeInterrupt('sessionSwitch');
    }
  }

  /**
   * Ensure a fresh-enough engine is warm and owned by `sessionId`, called under the
   * generation lock. On a genuine conversation switch (same model, different session)
   * we take the **nuclear** path: dispose the worker and recreate a fresh engine from
   * the WebLLM browser cache. First-ever conversation and same-session multi-turn just
   * load/reuse the warm engine (no recreate, no lost KV within the turn).
   */
  private async ensureEngineForSession(
    modelId: string,
    sessionId: string | undefined,
    signal?: AbortSignal,
  ): Promise<WebLLMEngineLike> {
    const localId = toLocalId(modelId);
    const switching =
      sessionId !== undefined &&
      this.servingSessionId !== null &&
      this.servingSessionId !== sessionId;

    if (switching && this.engine && this.warmModelId === localId) {
      await this.recreateEngineForSwitch(localId, signal);
    } else {
      // First load, same-session multi-turn, or model switch (ensureEngine already
      // spins a fresh worker when the model id changes).
      await this.load(modelId, signal);
    }

    if (sessionId !== undefined) {
      this.servingSessionId = sessionId;
    }
    return this.requireEngine();
  }

  /**
   * Reliable "new chat" on a switch: break any in-flight generation, terminate the
   * worker (killing any stuck streaming lock — mlc-ai/web-llm#701 / mlc-ai/mlc-llm#3113),
   * then recreate a fresh engine for the same model. Weights come from the WebLLM
   * browser cache, so this is a short warm rather than a full HF re-download.
   */
  private async recreateEngineForSwitch(localId: string, signal?: AbortSignal): Promise<void> {
    this.safeInterrupt('recreateEngineForSwitch');
    await this.disposeEngineAndWorker();
    // eslint-disable-next-line no-console -- operator-facing breadcrumb for switch recreate
    console.info(
      '[shellui.ai]',
      'conversation switch — recreating WebLLM worker (weights from cache)',
      { modelId: localId },
    );
    await this.ensureEngine(localId, {
      signal,
      onProgress: (ratio) => {
        this.progressListeners.forEach((listener) => listener(localId, ratio));
      },
    });
  }

  /**
   * Forcibly tear down the worker + engine. Deliberately does NOT await
   * `engine.unload()`: a wedged worker (stuck streaming lock) may never ack, so we
   * rely on `worker.terminate()`. Weights persist in the WebLLM browser cache.
   */
  private async disposeEngineAndWorker(): Promise<void> {
    await this.disposeWorker();
    this.engine = null;
    this.warmModelId = null;
  }

  /** Test helper — reset singleton state. */
  async resetForTests(): Promise<void> {
    for (const active of this.installs.values()) {
      active.controller.abort();
    }
    this.installs.clear();
    await this.disposeWorker();
    this.engine = null;
    this.warmModelId = null;
    this.loadPromise = null;
    this.loadingModelId = null;
    this.generationTail = Promise.resolve();
    this.servingSessionId = null;
  }

  private async acquireGenerationLock(): Promise<() => void> {
    const previous = this.generationTail;
    let release!: () => void;
    this.generationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return release;
  }

  private async withGenerationLock<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquireGenerationLock();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /** Best-effort clear of WebLLM's in-flight decode lock between turns. */
  private clearGeneration(engine: WebLLMEngineLike, context: string): void {
    try {
      engine.interruptGenerate?.();
    } catch (error) {
      // eslint-disable-next-line no-console -- interrupt failures are easy to miss otherwise
      console.error('[shellui.ai]', `interruptGenerate after ${context} failed`, error);
    }
  }

  private requireEngine(): WebLLMEngineLike {
    if (!this.engine) {
      throw new Error('WebLLM engine is not ready.');
    }
    return this.engine;
  }

  private async ensureEngine(
    localId: string,
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: number, text?: string) => void;
    },
  ): Promise<void> {
    if (this.warmModelId === localId && this.engine) {
      options.onProgress?.(1, 'Ready');
      return;
    }

    if (this.loadPromise && this.loadingModelId === localId) {
      await this.loadPromise;
      return;
    }

    this.loadingModelId = localId;
    this.loadPromise = this.createAndLoad(localId, options);
    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
      this.loadingModelId = null;
    }
  }

  private async createAndLoad(
    localId: string,
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: number, text?: string) => void;
    },
  ): Promise<void> {
    if (options.signal?.aborted) {
      throw new DOMException('Download cancelled', 'AbortError');
    }

    await this.disposeWorker();

    let webllm: WebLLMModule;
    try {
      webllm = await this.loadModule();
    } catch (error) {
      logAiError('loadModule', error, { modelId: localId, stage: 'import(@mlc-ai/web-llm)' });
      throw new Error(
        `Failed to load @mlc-ai/web-llm: ${formatUnknownError(error)}. ` +
          'Is it installed and visible to the shell Vite app? ' +
          '(shellui start should optimizeDeps.include @mlc-ai/web-llm and alias it from @shellui/core)',
        { cause: error instanceof Error ? error : undefined },
      );
    }

    let worker: Worker;
    try {
      worker = await this.createWorker();
    } catch (error) {
      logAiError('createWorker', error, { modelId: localId, stage: 'new Worker' });
      throw new Error(
        `Failed to start WebLLM worker: ${formatUnknownError(error)}. ` +
          'If Network shows no worker script, Vite module-worker bundling is broken.',
        { cause: error instanceof Error ? error : undefined },
      );
    }
    this.worker = worker;

    let lastProgressText: string | undefined;
    let sawProgress = false;
    const reportProgress = (ratio: number, text?: string) => {
      if (text) lastProgressText = text;
      if (ratio > 0 || (text && text.length > 0)) sawProgress = true;
      options.onProgress?.(ratio, text);
    };

    let settled = false;
    const abortError = () => new DOMException('Download cancelled', 'AbortError');

    // Worker script / uncaught failures never reach CreateWebWorkerMLCEngine's getPromise —
    // surface them on the main thread so Install does not hang or collapse to a generic toast.
    let detachWorkerGuards: () => void = () => undefined;
    const workerCrashPromise = new Promise<never>((_, reject) => {
      const onError = (event: Event) => {
        const detail = formatUnknownError(event);
        logAiError('worker.onerror', event, {
          modelId: localId,
          stage: 'worker.onerror',
          progressText: lastProgressText,
          beforeModelFetch: !sawProgress,
        });
        reject(
          new Error(
            `WebLLM worker crashed: ${detail || 'see DevTools → Worker console'}. ${
              !sawProgress
                ? 'No init progress yet — failure was before Hugging Face fetch (often GPU init).'
                : `Last progress: ${lastProgressText ?? '(none)'}`
            }`,
            {
              cause:
                typeof ErrorEvent !== 'undefined' &&
                event instanceof ErrorEvent &&
                event.error instanceof Error
                  ? event.error
                  : undefined,
            },
          ),
        );
      };
      const onMessageError = (event: MessageEvent) => {
        logAiError('worker.onmessageerror', event, {
          modelId: localId,
          stage: 'worker.onmessageerror',
          progressText: lastProgressText,
          beforeModelFetch: !sawProgress,
        });
        reject(
          new Error(
            `WebLLM worker messageerror: ${formatUnknownError(event)}. ` +
              'A non-cloneable value may have been posted between worker and main thread.',
          ),
        );
      };
      worker.addEventListener('error', onError);
      worker.addEventListener('messageerror', onMessageError);
      detachWorkerGuards = () => {
        worker.removeEventListener('error', onError);
        worker.removeEventListener('messageerror', onMessageError);
      };
    });

    // eslint-disable-next-line no-console -- stage breadcrumb for Install debugging
    console.info('[shellui.ai]', 'CreateWebWorkerMLCEngine starting', {
      modelId: localId,
      hint: 'HF fetches (if any) appear under the Worker Network tab, not the main document',
    });

    let enginePromise: Promise<WebLLMEngineLike>;
    try {
      enginePromise = webllm.CreateWebWorkerMLCEngine(worker, localId, {
        logLevel: 'INFO',
        initProgressCallback: (report) => {
          if (options.signal?.aborted) return;
          const ratio = mapInitProgress(report);
          reportProgress(ratio, report.text);
        },
      }) as Promise<WebLLMEngineLike>;
    } catch (error) {
      detachWorkerGuards();
      await this.disposeWorker();
      logAiError('CreateWebWorkerMLCEngine', error, {
        modelId: localId,
        stage: 'CreateWebWorkerMLCEngine.sync',
        beforeModelFetch: true,
      });
      throw new Error(`CreateWebWorkerMLCEngine failed before load: ${formatUnknownError(error)}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }

    // WebLLM rejects with a string (worker err.toString()) — always log the raw rejection.
    enginePromise = enginePromise.catch((rejection) => {
      logAiError('CreateWebWorkerMLCEngine.rejected', rejection, {
        modelId: localId,
        stage: 'CreateWebWorkerMLCEngine / reload',
        progressText: lastProgressText,
        beforeModelFetch: !sawProgress,
      });
      const mapped = mapWebLlmRuntimeError(rejection);
      const detail = formatInstallFailureMessage(rejection, {
        progressText: lastProgressText,
        beforeModelFetch: !sawProgress,
        fallback: 'WebLLM CreateWebWorkerMLCEngine rejected (see [shellui.ai] console)',
      });
      throw new Error(mapped ?? detail, {
        cause: rejection instanceof Error ? rejection : undefined,
      });
    });

    const abortPromise = new Promise<never>((_, reject) => {
      if (options.signal?.aborted) {
        reject(abortError());
        return;
      }
      options.signal?.addEventListener(
        'abort',
        () => {
          void this.disposeWorker();
          reject(abortError());
        },
        { once: true },
      );
    });

    try {
      const engine = await Promise.race([enginePromise, abortPromise, workerCrashPromise]);
      settled = true;
      detachWorkerGuards();

      if (options.signal?.aborted) {
        try {
          await engine.unload();
        } catch {
          // ignore
        }
        await this.disposeWorker();
        throw abortError();
      }

      this.engine = engine;
      this.warmModelId = localId;
      options.onProgress?.(1, 'Ready');
    } catch (error) {
      detachWorkerGuards();
      await this.disposeWorker();
      this.engine = null;
      this.warmModelId = null;
      if (options.signal?.aborted || isAbortError(error)) {
        throw abortError();
      }
      logAiError('createAndLoad', error, {
        modelId: localId,
        stage: 'engine.reload',
        progressText: lastProgressText,
        beforeModelFetch: !sawProgress,
      });
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        formatInstallFailureMessage(error, {
          progressText: lastProgressText,
          beforeModelFetch: !sawProgress,
          fallback: 'Model download failed',
        }),
      );
    } finally {
      // If create eventually resolves after abort, drop the late engine.
      if (!settled) {
        void enginePromise
          .then(async (engine) => {
            try {
              await engine.unload();
            } catch {
              // ignore
            }
          })
          .catch(() => undefined);
      }
    }
  }

  private async disposeWorker(): Promise<void> {
    const worker = this.worker;
    this.worker = null;
    if (!worker) return;
    try {
      worker.terminate();
    } catch {
      // ignore
    }
  }
}

function resolveMessages(options: {
  systemPrompt?: string;
  prompt: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  if (options.messages && options.messages.length > 0) {
    return options.messages;
  }
  return buildMessages(options.systemPrompt, options.prompt);
}

function buildMessages(
  systemPrompt: string | undefined,
  prompt: string,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });
  return messages;
}

let sharedEngine: WebLLMEngineService | null = null;

export function getSharedWebLLMEngine(): WebLLMEngineService {
  if (!sharedEngine) {
    sharedEngine = new WebLLMEngineService();
  }
  return sharedEngine;
}

/** Replace the shared engine (tests). */
export function setSharedWebLLMEngineForTests(engine: WebLLMEngineService | null): void {
  sharedEngine = engine;
}
