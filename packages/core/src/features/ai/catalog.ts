import type { AiModel } from './types.js';

/**
 * Curated browser catalog for v1. Models are listed as downloadable until the
 * WebLLM download pipeline lands — nothing is fetched automatically.
 */
export const BROWSER_MODEL_CATALOG: readonly AiModel[] = [
  {
    id: 'webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B Instruct',
    provider: 'webllm',
    sizeBytes: 700_000_000,
    status: 'downloadable',
    description: 'Small instruct model (≈700 MB). Good mobile candidate once download ships.',
  },
  {
    id: 'webllm:Phi-3.5-mini-instruct-q4f16_1-MLC',
    name: 'Phi 3.5 Mini Instruct',
    provider: 'webllm',
    sizeBytes: 2_300_000_000,
    status: 'downloadable',
    description: 'Stronger small model (≈2.3 GB). Needs WebGPU + more disk.',
  },
] as const;
