import { describe, expect, it, vi, afterEach } from 'vitest';
import { formatInstallFailureMessage, formatUnknownError, logAiError } from './formatAiError.js';

describe('formatUnknownError', () => {
  it('prefers Error.message', () => {
    expect(formatUnknownError(new Error('WebGPU device lost'))).toBe('WebGPU device lost');
    expect(formatUnknownError(new TypeError('Failed to fetch'))).toBe('TypeError: Failed to fetch');
  });

  it('stringifies non-Error throws (WebLLM worker rejects with strings)', () => {
    expect(formatUnknownError('boom')).toBe('boom');
    expect(
      formatUnknownError(
        'WebGPUNotAvailableError: WebGPU is not supported in your current environment',
      ),
    ).toContain('WebGPU is not supported');
    expect(formatUnknownError({ message: 'from object' })).toBe('from object');
    expect(formatUnknownError({ code: 42 })).toBe('{"code":42}');
    expect(formatUnknownError(null)).toBe('null');
  });

  it('unwraps Error.cause when message is empty', () => {
    const err = new Error('');
    Object.defineProperty(err, 'cause', { value: new Error('root cause') });
    expect(formatUnknownError(err)).toContain('root cause');
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

  it('explains pre-HF failure when no progress was seen', () => {
    const msg = formatInstallFailureMessage(
      {},
      { beforeModelFetch: true, fallback: 'Model download failed' },
    );
    expect(msg).toMatch(/before model download|Hugging Face/i);
    expect(msg).toMatch(/Worker/i);
  });

  it('annotates real errors that failed before HF fetch', () => {
    expect(
      formatInstallFailureMessage(new Error('Unable to find a compatible GPU'), {
        beforeModelFetch: true,
      }),
    ).toMatch(/before Hugging Face fetch/i);
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

  it('logs string rejections with rawType', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logAiError('CreateWebWorkerMLCEngine.rejected', 'Error: boom', {
      beforeModelFetch: true,
    });
    const payload = spy.mock.calls[0]?.[2] as { rawType?: string; beforeModelFetch?: boolean };
    expect(payload.rawType).toBe('string');
    expect(payload.beforeModelFetch).toBe(true);
  });
});
