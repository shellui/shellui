/**
 * Feature-detection + normalization for the **Chrome built-in Prompt API**
 * (`LanguageModel` / Gemini Nano). This is Chromium-only — Firefox, Safari, and
 * iPhone do not expose it, so callers must treat a `null` result as "hide the
 * provider entirely" (no warning, no disabled stub).
 *
 * Chrome has shipped a few shapes over time; we normalize the two we support:
 * - **Modern global** `LanguageModel` with `availability()` + `create()`.
 * - **Legacy namespace** `ai.languageModel` with `capabilities()`/`availability()` + `create()`.
 */

/** Normalized availability, following the current Prompt API spec vocabulary. */
export type PromptApiAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export type PromptRole = 'system' | 'user' | 'assistant';
export type PromptMessage = { role: PromptRole; content: string };

export type PromptApiMonitor = {
  addEventListener(type: 'downloadprogress', listener: (event: { loaded: number }) => void): void;
};

export type PromptApiCreateOptions = {
  initialPrompts?: PromptMessage[];
  signal?: AbortSignal;
  monitor?: (monitor: PromptApiMonitor) => void;
};

export type PromptApiSession = {
  prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming(
    input: string,
    options?: { signal?: AbortSignal },
  ): ReadableStream<string> | AsyncIterable<string>;
  destroy?(): void;
};

/** Small normalized surface the adapter talks to, regardless of the Chrome shape. */
export type NormalizedPromptApi = {
  availability(): Promise<PromptApiAvailability>;
  create(options?: PromptApiCreateOptions): Promise<PromptApiSession>;
};

function normalizeAvailability(value: unknown): PromptApiAvailability {
  switch (value) {
    case 'available':
    case 'readily':
      return 'available';
    case 'downloadable':
    case 'after-download':
      return 'downloadable';
    case 'downloading':
      return 'downloading';
    default:
      return 'unavailable';
  }
}

type ModernPromptApiGlobal = {
  availability?: (options?: unknown) => Promise<string>;
  create?: (options?: unknown) => Promise<PromptApiSession>;
};

type LegacyPromptApiNamespace = {
  languageModel?: {
    availability?: (options?: unknown) => Promise<string>;
    capabilities?: () => Promise<{ available?: string }>;
    create?: (options?: unknown) => Promise<PromptApiSession>;
  };
};

/**
 * Resolve the Chrome Prompt API from a global scope, or `null` when absent.
 * `scope` is injectable so tests can pass a fake `globalThis`.
 */
export function getPromptApi(
  scope: typeof globalThis = typeof globalThis !== 'undefined' ? globalThis : ({} as never),
): NormalizedPromptApi | null {
  const global = scope as unknown as {
    LanguageModel?: ModernPromptApiGlobal;
    ai?: LegacyPromptApiNamespace;
  };

  const modern = global.LanguageModel;
  if (modern && typeof modern.create === 'function' && typeof modern.availability === 'function') {
    const create = modern.create.bind(modern);
    const availability = modern.availability.bind(modern);
    return {
      availability: async () => normalizeAvailability(await availability()),
      create: (options) => create(options) as Promise<PromptApiSession>,
    };
  }

  const legacy = global.ai?.languageModel;
  if (legacy && typeof legacy.create === 'function') {
    const create = legacy.create.bind(legacy);
    return {
      availability: async () => {
        if (typeof legacy.availability === 'function') {
          return normalizeAvailability(await legacy.availability());
        }
        if (typeof legacy.capabilities === 'function') {
          const caps = await legacy.capabilities();
          return normalizeAvailability(caps?.available);
        }
        return 'unavailable';
      },
      create: (options) => create(options) as Promise<PromptApiSession>,
    };
  }

  return null;
}

/** Cheap presence check (does not call `availability()`). */
export function isPromptApiPresent(scope?: typeof globalThis): boolean {
  return getPromptApi(scope) !== null;
}
