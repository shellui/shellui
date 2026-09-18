import { describe, expect, it } from 'vitest';
import {
  mapWebLlmRuntimeError,
  probeWebLlmBrowserSupport,
  WEBLLM_UNSUPPORTED_BROWSER_MESSAGE,
} from './webLlmBrowserSupport.js';

describe('probeWebLlmBrowserSupport', () => {
  it('allows Chromium / Edge user agents', () => {
    expect(
      probeWebLlmBrowserSupport(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ).supported,
    ).toBe(true);
    expect(
      probeWebLlmBrowserSupport(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      ).supported,
    ).toBe(true);
  });

  it('rejects Firefox', () => {
    const result = probeWebLlmBrowserSupport(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
    );
    expect(result.supported).toBe(false);
    expect(result.reason).toBe('firefox');
    expect(result.detail).toBe(WEBLLM_UNSUPPORTED_BROWSER_MESSAGE);
  });

  it('rejects Safari', () => {
    const result = probeWebLlmBrowserSupport(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    );
    expect(result.supported).toBe(false);
    expect(result.reason).toBe('safari');
  });
});

describe('mapWebLlmRuntimeError', () => {
  it('maps WebGPU-ish errors on Firefox to the clear message', () => {
    expect(
      mapWebLlmRuntimeError(
        new Error('Failed to get GPU adapter'),
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
      ),
    ).toBe(WEBLLM_UNSUPPORTED_BROWSER_MESSAGE);
  });

  it('does not remap on Chromium', () => {
    expect(
      mapWebLlmRuntimeError(
        new Error('Failed to get GPU adapter'),
        'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36',
      ),
    ).toBeNull();
  });
});
