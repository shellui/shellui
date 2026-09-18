import { describe, expect, it } from 'vitest';
import { normalizeWebLlmModule } from './webllmEngine.js';

describe('normalizeWebLlmModule', () => {
  const api = {
    CreateWebWorkerMLCEngine: () => undefined,
    deleteModelAllInfoInCache: async () => undefined,
  };

  it('returns the module when CreateWebWorkerMLCEngine is a named export', () => {
    expect(normalizeWebLlmModule(api)).toBe(api);
  });

  it('unwraps .default when needsInterop hid named exports', () => {
    expect(normalizeWebLlmModule({ default: api })).toBe(api);
  });

  it('throws a clear error when the export is missing', () => {
    expect(() => normalizeWebLlmModule({ default: {} })).toThrow(
      /CreateWebWorkerMLCEngine is missing/i,
    );
    expect(() => normalizeWebLlmModule({})).toThrow(/needsInterop/i);
  });
});
