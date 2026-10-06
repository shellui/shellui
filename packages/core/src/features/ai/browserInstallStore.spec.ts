import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  BROWSER_INSTALL_STORAGE_KEY,
  clearBrowserInstalledForTests,
  estimateInstalledCatalogBytes,
  isBrowserModelInstalled,
  listBrowserInstalledIds,
  markBrowserModelInstalled,
  removeBrowserModelInstalled,
} from './browserInstallStore.js';

describe('browserInstallStore', () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });
    clearBrowserInstalledForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists install records across mark/list/remove', () => {
    expect(listBrowserInstalledIds()).toEqual([]);
    markBrowserModelInstalled('webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC');
    expect(isBrowserModelInstalled('Llama-3.2-1B-Instruct-q4f16_1-MLC')).toBe(true);
    expect(listBrowserInstalledIds()).toEqual(['Llama-3.2-1B-Instruct-q4f16_1-MLC']);
    expect(memory.get(BROWSER_INSTALL_STORAGE_KEY)).toContain('Llama-3.2-1B-Instruct-q4f16_1-MLC');

    removeBrowserModelInstalled('Llama-3.2-1B-Instruct-q4f16_1-MLC');
    expect(listBrowserInstalledIds()).toEqual([]);
  });

  it('is shared for second-app reuse of the same origin catalog', () => {
    markBrowserModelInstalled('Phi-3.5-mini-instruct-q4f16_1-MLC');
    expect(isBrowserModelInstalled('webllm:Phi-3.5-mini-instruct-q4f16_1-MLC')).toBe(true);
  });

  it('estimates catalog bytes for installed records', () => {
    markBrowserModelInstalled('webllm:a');
    expect(
      estimateInstalledCatalogBytes([
        { id: 'webllm:a', sizeBytes: 100 },
        { id: 'webllm:b', sizeBytes: 200 },
      ]),
    ).toBe(100);
  });
});
