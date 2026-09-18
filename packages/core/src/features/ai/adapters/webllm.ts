import { BROWSER_MODEL_CATALOG } from '../catalog.js';
import {
  isBrowserModelInstalled,
  listBrowserInstalledIds,
  markBrowserModelInstalled,
  removeBrowserModelInstalled,
} from '../browserInstallStore.js';
import { probeWebGpu } from '../status.js';
import type { AiAdapter, AiModel, AiPromptOptions, AiStreamChunk } from '../types.js';

export type BrowserDownloadProgress = {
  modelId: string;
  /** 0–1 */
  progress: number;
};

/**
 * WebLLM-shaped browser adapter.
 *
 * Catalog install/delete persists in localStorage so every app on this origin
 * reuses the same installed set. Weight download + inference are not wired yet;
 * `download` records a catalog install only (honest stub for Settings UX).
 */
export class WebLLMAdapter implements AiAdapter {
  readonly id = 'webllm' as const;
  private readonly activeDownloads = new Map<string, AbortController>();
  private readonly progress = new Map<string, number>();

  async isAvailable(): Promise<boolean> {
    const gpu = await probeWebGpu();
    return gpu.available;
  }

  async listModels(): Promise<AiModel[]> {
    const gpu = await probeWebGpu();
    const installed = new Set(listBrowserInstalledIds());
    return BROWSER_MODEL_CATALOG.map((model) => {
      const localName = model.id.replace(/^webllm:/, '');
      if (this.activeDownloads.has(localName) || this.progress.has(localName)) {
        return { ...model, status: 'downloading' as const };
      }
      if (installed.has(localName) || isBrowserModelInstalled(localName)) {
        return {
          ...model,
          status: gpu.available ? ('ready' as const) : ('needs-webgpu' as const),
        };
      }
      if (!gpu.available) {
        return { ...model, status: 'needs-webgpu' as const };
      }
      return { ...model, status: 'downloadable' as const };
    });
  }

  getDownloadProgress(modelId: string): number | null {
    const localId = modelId.replace(/^webllm:/, '');
    return this.progress.has(localId) ? (this.progress.get(localId) ?? 0) : null;
  }

  /**
   * Stub catalog install with cancellable progress.
   * Does not fetch weights; marks the model installed when complete so Settings
   * and a second app share the record. Inference still throws until WebLLM lands.
   */
  async download(
    modelId: string,
    options?: { signal?: AbortSignal; onProgress?: (progress: number) => void },
  ): Promise<void> {
    const localId = modelId.replace(/^webllm:/, '');
    if (isBrowserModelInstalled(localId)) return;

    const gpu = await probeWebGpu();
    if (!gpu.available) {
      throw new Error('WebGPU is required before a browser model can be installed.');
    }

    if (this.activeDownloads.has(localId)) {
      throw new Error('A download is already in progress for this model.');
    }

    const controller = new AbortController();
    this.activeDownloads.set(localId, controller);
    this.progress.set(localId, 0);

    const onAbort = () => controller.abort();
    options?.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      for (let step = 1; step <= 10; step += 1) {
        if (controller.signal.aborted || options?.signal?.aborted) {
          throw new DOMException('Download cancelled', 'AbortError');
        }
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => resolve(), 80);
          const onStepAbort = () => {
            clearTimeout(timer);
            reject(new DOMException('Download cancelled', 'AbortError'));
          };
          controller.signal.addEventListener('abort', onStepAbort, { once: true });
          options?.signal?.addEventListener('abort', onStepAbort, { once: true });
        });
        const value = step / 10;
        this.progress.set(localId, value);
        options?.onProgress?.(value);
      }
      markBrowserModelInstalled(localId);
    } finally {
      options?.signal?.removeEventListener('abort', onAbort);
      this.activeDownloads.delete(localId);
      this.progress.delete(localId);
    }
  }

  cancelDownload(modelId: string): void {
    const localId = modelId.replace(/^webllm:/, '');
    this.activeDownloads.get(localId)?.abort();
  }

  async deleteInstalled(modelId: string): Promise<void> {
    const localId = modelId.replace(/^webllm:/, '');
    this.cancelDownload(localId);
    removeBrowserModelInstalled(localId);
  }

  async load(modelId: string, _signal?: AbortSignal): Promise<void> {
    if (!isBrowserModelInstalled(modelId)) {
      throw new Error(
        `Browser model "${modelId}" is not installed yet. Install it from Settings → AI.`,
      );
    }
    // TODO(ai): warm WebLLM engine with weights from OPFS
  }

  async prompt(_options: AiPromptOptions): Promise<string> {
    throw new Error(
      'Browser inference is not available yet. Use an Ollama model, or wait for the WebLLM engine.',
    );
  }

  async *promptStreaming(_options: AiPromptOptions): AsyncIterable<AiStreamChunk> {
    throw new Error(
      'Browser streaming is not available yet. Use an Ollama model, or wait for the WebLLM engine.',
    );
    yield { text: '', done: true };
  }

  async unload(_modelId?: string): Promise<void> {
    // TODO(ai): dispose engine / free GPU memory
  }

  /** Test helper. */
  markInstalled(modelId: string): void {
    markBrowserModelInstalled(modelId);
  }
}
