import { BROWSER_MODEL_CATALOG } from '../catalog.js';
import { probeWebGpu } from '../status.js';
import type { AiAdapter, AiModel, AiPromptOptions, AiStreamChunk } from '../types.js';

/**
 * WebLLM-shaped browser adapter stub.
 *
 * Lists the curated catalog as downloadable. Download / OPFS / engine load is
 * intentionally not implemented in this vertical slice — see TODOs below.
 *
 * TODO(ai): download pipeline (resumable fetch → OPFS, checksum, progress)
 * TODO(ai): instantiate WebLLM (or swap-in Transformers.js) behind this adapter
 * TODO(ai): unload on memory pressure / tab background
 */
export class WebLLMAdapter implements AiAdapter {
  readonly id = 'webllm' as const;
  private readonly installedIds = new Set<string>();

  async isAvailable(): Promise<boolean> {
    const gpu = await probeWebGpu();
    return gpu.available;
  }

  async listModels(): Promise<AiModel[]> {
    const gpu = await probeWebGpu();
    return BROWSER_MODEL_CATALOG.map((model) => {
      const localName = model.id.replace(/^webllm:/, '');
      if (this.installedIds.has(localName)) {
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

  async load(modelId: string, _signal?: AbortSignal): Promise<void> {
    if (!this.installedIds.has(modelId)) {
      throw new Error(
        `Browser model "${modelId}" is not downloaded yet. Download from Settings → AI (pipeline TODO).`,
      );
    }
    // TODO(ai): warm WebLLM engine with weights from OPFS
  }

  async prompt(_options: AiPromptOptions): Promise<string> {
    throw new Error('WebLLM prompt is not implemented yet. Use an Ollama model when available.');
  }

  async *promptStreaming(_options: AiPromptOptions): AsyncIterable<AiStreamChunk> {
    throw new Error('WebLLM streaming is not implemented yet. Use an Ollama model when available.');
    // Unreachable; keeps the generator typed.
    yield { text: '', done: true };
  }

  async unload(_modelId?: string): Promise<void> {
    // TODO(ai): dispose engine / free GPU memory
  }

  /** Test helper / future Settings download hook. */
  markInstalled(modelId: string): void {
    this.installedIds.add(modelId.replace(/^webllm:/, ''));
  }
}
