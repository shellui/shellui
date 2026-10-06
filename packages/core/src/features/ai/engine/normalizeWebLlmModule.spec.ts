import { describe, expect, it, vi, afterEach } from 'vitest';
import { normalizeWebLlmModule } from './webllmEngine.js';

describe('normalizeWebLlmModule', () => {
  const api = {
    CreateWebWorkerMLCEngine: () => undefined,
    deleteModelAllInfoInCache: async () => undefined,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the module when CreateWebWorkerMLCEngine is a named export', () => {
    expect(normalizeWebLlmModule(api)).toBe(api);
  });

  it('unwraps .default when interop hid named exports', () => {
    expect(normalizeWebLlmModule({ default: api })).toBe(api);
  });

  it('unwraps nested .default.default', () => {
    expect(normalizeWebLlmModule({ default: { default: api } })).toBe(api);
  });

  it('falls back to CreateMLCEngine when the worker factory is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const createMain = vi.fn(async () => ({ ok: true }));
    const mod = normalizeWebLlmModule({
      CreateMLCEngine: createMain,
      deleteModelAllInfoInCache: async () => undefined,
    });
    expect(typeof mod.CreateWebWorkerMLCEngine).toBe('function');
    await mod.CreateWebWorkerMLCEngine({} as Worker, 'model-id', {});
    expect(createMain).toHaveBeenCalledWith('model-id', {}, undefined);
    expect(warn).toHaveBeenCalled();
  });

  it('throws a clear error when the export is missing', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => normalizeWebLlmModule({ default: {} })).toThrow(
      /CreateWebWorkerMLCEngine is missing/i,
    );
    expect(() => normalizeWebLlmModule({})).toThrow(/Exclude @mlc-ai\/web-llm/i);
    expect(err).toHaveBeenCalled();
  });
});
