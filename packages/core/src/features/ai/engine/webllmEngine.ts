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
import { mapInitProgress } from './mapInitProgress.js';

export type WebLLMModule = typeof import('@mlc-ai/web-llm');

export type WebLLMEngineLike = Pick<
  MLCEngineInterface,
  'chat' | 'unload' | 'reload' | 'setInitProgressCallback'
> & {
  /** Optional terminate for test doubles / worker clients. */
  worker?: Worker;
};

export type LoadWebLLMModule = () => Promise<WebLLMModule>;

export type CreateWorkerFn = () => Worker;

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

const defaultLoadModule: LoadWebLLMModule = () => import('@mlc-ai/web-llm');

/**
 * Spawn the dedicated worker only at install/load time (never on module import).
 * The worker entry statically imports WebLLM; constructing it is what pulls that chunk.
 */
const defaultCreateWorker: CreateWorkerFn = () =>
  new Worker(new URL('./webllm.worker.ts', import.meta.url), {
    type: 'module',
    name: 'shellui-webllm',
  });

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
  private readonly installs = new Map<string, ActiveInstall>();
  private readonly progressListeners = new Set<(localId: string, progress: number) => void>();

  constructor(options: WebLLMEngineServiceOptions = {}) {
    this.loadModule = options.loadModule ?? defaultLoadModule;
    this.createWorker = options.createWorker ?? defaultCreateWorker;
    this.useTransferToast = options.useTransferToast !== false;
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
      const aborted =
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError');
      if (aborted) {
        if (this.useTransferToast) {
          markTransferCancelled(transferId);
        }
        throw error instanceof DOMException
          ? error
          : new DOMException('Download cancelled', 'AbortError');
      }
      const message = error instanceof Error ? error.message : 'Model download failed';
      if (this.useTransferToast) {
        failTransfer(transferId, message);
      }
      throw error instanceof Error ? error : new Error(message);
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
  }): Promise<string> {
    await this.load(options.modelId, options.signal);
    const engine = this.requireEngine();
    const messages = buildMessages(options.systemPrompt, options.prompt);
    const response = await engine.chat.completions.create({
      messages,
      stream: false,
    });
    if (options.signal?.aborted) {
      throw new DOMException('Prompt aborted', 'AbortError');
    }
    const choice = response.choices?.[0]?.message?.content;
    return typeof choice === 'string' ? choice : '';
  }

  async *promptStreaming(options: {
    modelId: string;
    prompt: string;
    systemPrompt?: string;
    signal?: AbortSignal;
  }): AsyncIterable<{ text: string; done: boolean }> {
    await this.load(options.modelId, options.signal);
    const engine = this.requireEngine();
    const messages = buildMessages(options.systemPrompt, options.prompt);
    const stream = (await engine.chat.completions.create({
      messages,
      stream: true,
      stream_options: { include_usage: false },
    })) as AsyncIterable<ChatCompletionChunk>;

    for await (const chunk of stream) {
      if (options.signal?.aborted) {
        throw new DOMException('Prompt aborted', 'AbortError');
      }
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      const finish = chunk.choices?.[0]?.finish_reason;
      if (delta) {
        yield { text: delta, done: false };
      }
      if (finish) {
        yield { text: '', done: true };
        return;
      }
    }
    yield { text: '', done: true };
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

    const webllm = await this.loadModule();
    const worker = this.createWorker();
    this.worker = worker;

    let settled = false;
    const abortError = () => new DOMException('Download cancelled', 'AbortError');

    const enginePromise = webllm.CreateWebWorkerMLCEngine(worker, localId, {
      initProgressCallback: (report) => {
        if (options.signal?.aborted) return;
        const ratio = mapInitProgress(report);
        options.onProgress?.(ratio, report.text);
      },
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
      const engine = await Promise.race([enginePromise, abortPromise]);
      settled = true;

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
      await this.disposeWorker();
      this.engine = null;
      this.warmModelId = null;
      if (
        options.signal?.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        throw abortError();
      }
      throw error;
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

function buildMessages(
  systemPrompt: string | undefined,
  prompt: string,
): Array<{ role: 'system' | 'user'; content: string }> {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
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
