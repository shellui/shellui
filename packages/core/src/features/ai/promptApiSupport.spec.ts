import { describe, expect, it } from 'vitest';
import { getPromptApi, isPromptApiPresent } from './promptApiSupport.js';

/** Resolve or fail the test — keeps assertions free of non-null (`!`) operators. */
function resolve(scope: typeof globalThis) {
  const api = getPromptApi(scope);
  if (!api) throw new Error('expected Prompt API to be detected');
  return api;
}

function modernScope(availability: string) {
  return {
    LanguageModel: {
      availability: async () => availability,
      create: async () => ({
        prompt: async () => 'ok',
        promptStreaming: () => (async function* () {})(),
        destroy: () => undefined,
      }),
    },
  } as unknown as typeof globalThis;
}

function legacyScope(available: string) {
  return {
    ai: {
      languageModel: {
        capabilities: async () => ({ available }),
        create: async () => ({
          prompt: async () => 'ok',
          promptStreaming: () => (async function* () {})(),
          destroy: () => undefined,
        }),
      },
    },
  } as unknown as typeof globalThis;
}

describe('getPromptApi', () => {
  it('returns null when no Prompt API global is present (Firefox / Safari / iPhone)', () => {
    const scope = {} as unknown as typeof globalThis;
    expect(getPromptApi(scope)).toBeNull();
    expect(isPromptApiPresent(scope)).toBe(false);
  });

  it('detects the modern LanguageModel global and normalizes availability', async () => {
    expect(await resolve(modernScope('available')).availability()).toBe('available');
  });

  it('maps downloadable / downloading availability', async () => {
    expect(await resolve(modernScope('downloadable')).availability()).toBe('downloadable');
    expect(await resolve(modernScope('downloading')).availability()).toBe('downloading');
  });

  it('normalizes unknown / no availability to unavailable', async () => {
    expect(await resolve(modernScope('no')).availability()).toBe('unavailable');
  });

  it('supports the legacy ai.languageModel capabilities() shape', async () => {
    expect(await resolve(legacyScope('readily')).availability()).toBe('available');
    expect(await resolve(legacyScope('after-download')).availability()).toBe('downloadable');
    expect(await resolve(legacyScope('no')).availability()).toBe('unavailable');
  });
});
