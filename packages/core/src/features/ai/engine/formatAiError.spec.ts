import { describe, expect, it, vi, afterEach } from 'vitest';
import { formatInstallFailureMessage, formatUnknownError, logAiError } from './formatAiError.js';

describe('formatUnknownError', () => {
  it('prefers Error.message', () => {
    expect(formatUnknownError(new Error('WebGPU device lost'))).toBe('WebGPU device lost');
    expect(formatUnknownError(new TypeError('Failed to fetch'))).toBe('TypeError: Failed to fetch');
  });

  it('stringifies non-Error throws', () => {
    expect(formatUnknownError('boom')).toBe('boom');
    expect(formatUnknownError({ message: 'from object' })).toBe('from object');
    expect(formatUnknownError({ code: 42 })).toBe('{"code":42}');
    expect(formatUnknownError(null)).toBe('null');
  });
});

describe('formatInstallFailureMessage', () => {
  it('appends last progress text', () => {
    expect(
      formatInstallFailureMessage(new Error('Device lost'), {
        progressText: 'Loading model from cache…',
      }),
    ).toBe('Device lost (Failed during: Loading model from cache…)');
  });

  it('uses fallback when the throw has no useful message', () => {
    expect(formatInstallFailureMessage({}, { fallback: 'Model download failed' })).toContain(
      'Model download failed',
    );
  });
});

describe('logAiError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs under [shellui.ai] with stack when available', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const err = new Error('nope');
    logAiError('install', err, { modelId: 'Llama', progressText: 'Downloading' });
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0]?.[0]).toBe('[shellui.ai]');
    expect(spy.mock.calls[0]?.[1]).toBe('install');
  });
});
