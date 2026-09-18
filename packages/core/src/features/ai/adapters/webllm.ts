import { BROWSER_MODEL_CATALOG } from '../catalog.js';
import {
  isBrowserModelInstalled,
  listBrowserInstalledIds,
  markBrowserModelInstalled,
} from '../browserInstallStore.js';
import { getSharedWebLLMEngine, type WebLLMEngineService } from '../engine/webllmEngine.js';
import { probeWebGpu } from '../status.js';
import type { AiAdapter, AiModel, AiPromptOptions, AiStreamChunk } from '../types.js';
import { mapWebLlmRuntimeError } from '../webLlmBrowserSupport.js';

export type BrowserDownloadProgress = {
  modelId: string;
  /** 0–1 */
  progress: number;
};

export type WebLLMAdapterOptions = {
  engine?: WebLLMEngineService;
};

/**
 * Browser adapter backed by a shell-owned WebLLM worker engine.
 *
 * Install fetches MLC weights via `@mlc-ai/web-llm` (HF URLs from the prebuilt
 * model library), reports `initProgressCallback` progress, and keeps the model
 * warm so `prompt` / `promptStreaming` work immediately after Install.
 *
 * Firefox/Safari: catalog shows `unsupported` — WebLLM needs Chromium WebGPU.
 */
export class WebLLMAdapter implements AiAdapter {
  readonly id = 'webllm' as const;
  private readonly engine: WebLLMEngineService;

  constructor(options: WebLLMAdapterOptions = {}) {
    this.engine = options.engine ?? getSharedWebLLMEngine();
  }

  getEngine(): WebLLMEngineService {
    return this.engine;
  }

  async isAvailable(): Promise<boolean> {
    // Install is allowed on any browser now; availability tracks WebGPU only.
    const gpu = await probeWebGpu();
    return gpu.available;
  }

  async listModels(): Promise<AiModel[]> {
    const gpu = await probeWebGpu();
    const installed = new Set(listBrowserInstalledIds());
    return BROWSER_MODEL_CATALOG.map((model) => {
      const localName = model.id.replace(/^webllm:/, '');
      if (this.engine.isDownloading(localName)) {
        return { ...model, status: 'downloading' as const };
      }
      if (
        installed.has(localName) ||
        isBrowserModelInstalled(localName) ||
        this.engine.getWarmModelId() === localName
      ) {
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
    return this.engine.getDownloadProgress(modelId);
  }

  async download(
    modelId: string,
    options?: { signal?: AbortSignal; onProgress?: (progress: number) => void },
  ): Promise<void> {
    // Non-Chromium browsers are experimental, not blocked: let the user try and
    // surface the real error (mapped below) instead of an opaque pre-emptive block.
    const gpu = await probeWebGpu();
    if (!gpu.available) {
      throw new Error(
        'WebGPU is not available in this browser. Enable WebGPU (chrome://gpu / about:config) or use Ollama.',
      );
    }
    try {
      await this.engine.install(modelId, options);
    } catch (error) {
      // Engine already mapped Firefox / WebGPU cases; only remap raw leftover throws.
      if (
        error instanceof Error &&
        /WebLLM worker crashed|WebGPU failed in the WebLLM worker|Browser models need Chrome/i.test(
          error.message,
        )
      ) {
        throw error;
      }
      const mapped = mapWebLlmRuntimeError(error);
      if (mapped) {
        throw new Error(mapped, { cause: error instanceof Error ? error : undefined });
      }
      throw error;
    }
  }

  cancelDownload(modelId: string): void {
    this.engine.cancelDownload(modelId);
  }

  async deleteInstalled(modelId: string): Promise<void> {
    await this.engine.deleteInstalled(modelId);
  }

  async load(modelId: string, signal?: AbortSignal): Promise<void> {
    await this.engine.load(modelId, signal);
  }

  async prompt(options: AiPromptOptions): Promise<string> {
    return this.engine.prompt(options);
  }

  async *promptStreaming(options: AiPromptOptions): AsyncIterable<AiStreamChunk> {
    yield* this.engine.promptStreaming(options);
  }

  async unload(modelId?: string): Promise<void> {
    await this.engine.unload(modelId);
  }

  async resetConversation(modelId?: string, sessionId?: string): Promise<void> {
    await this.engine.resetConversation(modelId, sessionId);
  }

  /** Test helper. */
  markInstalled(modelId: string): void {
    markBrowserModelInstalled(modelId);
  }
}
