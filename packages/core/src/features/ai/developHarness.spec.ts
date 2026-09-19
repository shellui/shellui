import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '@shellui/sdk';
import { AiRegistry } from './registry.js';
import type { AiAdapter, AiModel, AiPromptOptions, AiStreamChunk } from './types.js';
import {
  collectDevelopAiDiagnostics,
  DEVELOP_AI_TEST_PROMPT,
  runDevelopAiPrompt,
  runDevelopAiStream,
} from './developHarness.js';

const tinyModel: AiModel = {
  id: 'ollama:tiny',
  name: 'tiny',
  provider: 'ollama',
  status: 'ready',
};

const fakeAdapter: AiAdapter = {
  id: 'ollama',
  isAvailable: async () => true,
  listModels: async () => [tinyModel],
  load: async () => undefined,
  prompt: async (options: AiPromptOptions) =>
    options.prompt === DEVELOP_AI_TEST_PROMPT ? 'pong' : `echo:${options.prompt}`,
  promptStreaming: async function* (): AsyncIterable<AiStreamChunk> {
    yield { text: 'po', done: false };
    yield { text: 'ng', done: true };
  },
  unload: async () => undefined,
};

vi.mock('./status.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./status.js')>();
  return {
    ...actual,
    probeWebGpu: vi.fn(async () => ({ available: true })),
    probeOllama: vi.fn(async () => ({
      reachable: true,
      baseUrl: 'http://127.0.0.1:11434',
      latencyMs: 12,
    })),
  };
});

vi.mock('./handleRequest.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./handleRequest.js')>();
  return {
    ...actual,
    createShellAiRegistry: vi.fn(
      (settings: Settings) =>
        new AiRegistry({
          adapters: [fakeAdapter],
          defaultModelId: settings.ai?.defaultModelId ?? 'ollama:tiny',
        }),
    ),
  };
});

const baseSettings = {
  developerFeatures: { enabled: true },
  errorReporting: { enabled: false },
  logging: { namespaces: { shellsdk: false, shellcore: false } },
  appearance: {
    name: 'default',
    displayName: 'Default',
    mode: 'light',
    colorScheme: 'system',
    colors: { light: {}, dark: {} },
  },
  language: { code: 'en' },
  region: { timezone: 'UTC' },
  ai: {
    enabled: true,
    defaultModelId: 'ollama:tiny',
    ollamaEnabled: true,
    browserEnabled: true,
  },
  user: null,
  accessToken: null,
} as Settings;

describe('developHarness', () => {
  it('collects diagnostics from probes + registry', async () => {
    const diagnostics = await collectDevelopAiDiagnostics(baseSettings);
    expect(diagnostics.webGpuAvailable).toBe(true);
    expect(diagnostics.ollamaReachable).toBe(true);
    expect(diagnostics.ollamaLatencyMs).toBe(12);
    expect(diagnostics.adapters).toEqual(['ollama']);
    expect(diagnostics.defaultModelId).toBe('ollama:tiny');
    expect(diagnostics.models.map((m) => m.id)).toContain('ollama:tiny');
  });

  it('runs a one-shot prompt through handleAiRequest', async () => {
    const result = await runDevelopAiPrompt(baseSettings);
    expect(result.modelId).toBe('ollama:tiny');
    expect(result.text).toBe('pong');
  });

  it('streams chunks through handleAiRequest', async () => {
    const chunks: string[] = [];
    const result = await runDevelopAiStream(baseSettings, DEVELOP_AI_TEST_PROMPT, (chunk) => {
      chunks.push(chunk);
    });
    expect(chunks.join('')).toBe('pong');
    expect(result.text).toBe('pong');
  });
});
