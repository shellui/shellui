import { describe, expect, it } from 'vitest';
import {
  mapWebLlmRuntimeError,
  probeWebLlmBrowserSupport,
  WEBLLM_EXPERIMENTAL_BROWSER_MESSAGE,
  WEBLLM_WEBGPU_WORKER_FAILED_MESSAGE,
} from './webLlmBrowserSupport.js';

describe('probeWebLlmBrowserSupport', () => {
  it('recommends Chromium / Edge user agents (Install allowed)', () => {
    const chrome = probeWebLlmBrowserSupport(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    );
    expect(chrome.recommended).toBe(true);
    expect(chrome.canInstall).toBe(true);
    const edge = probeWebLlmBrowserSupport(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    );
    expect(edge.recommended).toBe(true);
    expect(edge.canInstall).toBe(true);
  });

  it('marks Firefox experimental but still installable', () => {
    const result = probeWebLlmBrowserSupport(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
    );
    expect(result.recommended).toBe(false);
    expect(result.canInstall).toBe(true);
    expect(result.reason).toBe('firefox');
    expect(result.detail).toBe(WEBLLM_EXPERIMENTAL_BROWSER_MESSAGE);
  });

  it('recommends Safari like Chromium (Install allowed, no experimental warning)', () => {
    const result = probeWebLlmBrowserSupport(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    );
    expect(result.recommended).toBe(true);
    expect(result.canInstall).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.detail).toBe('');
  });
});

describe('mapWebLlmRuntimeError', () => {
  it('maps WebGPU-ish errors on Firefox to the experimental-browser guidance', () => {
    expect(
      mapWebLlmRuntimeError(
        new Error('Failed to get GPU adapter'),
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
      ),
    ).toBe(WEBLLM_EXPERIMENTAL_BROWSER_MESSAGE);
  });

  it('maps WebGPU-ish errors on Chromium to the worker WebGPU message', () => {
    expect(
      mapWebLlmRuntimeError(
        new Error('Unable to find a compatible GPU'),
        'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36',
      ),
    ).toBe(WEBLLM_WEBGPU_WORKER_FAILED_MESSAGE);
  });

  it('maps WebGPU-ish errors on Safari to the worker WebGPU message (not experimental)', () => {
    expect(
      mapWebLlmRuntimeError(
        new Error('Failed to get GPU adapter'),
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      ),
    ).toBe(WEBLLM_WEBGPU_WORKER_FAILED_MESSAGE);
  });

  it('maps WebLLM string rejections (worker err.toString())', () => {
    expect(
      mapWebLlmRuntimeError(
        'WebGPUNotAvailableError: WebGPU is not supported in your current environment',
        'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36',
      ),
    ).toBe(WEBLLM_WEBGPU_WORKER_FAILED_MESSAGE);
  });

  it('returns null for non-WebGPU errors', () => {
    expect(
      mapWebLlmRuntimeError(new Error('some unrelated failure'), 'Mozilla/5.0 Chrome/131'),
    ).toBeNull();
  });
});
