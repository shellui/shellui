import { describe, expect, test } from 'vitest';
import {
  isBlockedCompanionHost,
  isLoopbackHost,
  parseCompanionUrl,
  validateCompanionUrl,
} from '../companion-url.js';

describe('companion-url', () => {
  test('isLoopbackHost recognizes common loopback names', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
    expect(isLoopbackHost('evil.com')).toBe(false);
  });

  test('isBlockedCompanionHost rejects metadata endpoints', () => {
    expect(isBlockedCompanionHost('169.254.169.254')).toBe(true);
    expect(isBlockedCompanionHost('metadata.google.internal')).toBe(true);
    expect(isBlockedCompanionHost('localhost')).toBe(false);
  });

  test('parseCompanionUrl accepts host:port shorthand', () => {
    const parsed = parseCompanionUrl('localhost:5173');
    expect(parsed?.hostname).toBe('localhost');
    expect(parsed?.port).toBe('5173');
  });

  test('validateCompanionUrl accepts loopback http URLs', () => {
    const result = validateCompanionUrl('http://localhost:5173', { source: 'dev.url' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe('http://localhost:5173');
      expect(result.warnings).toHaveLength(0);
    }
  });

  test('validateCompanionUrl rejects cloud metadata', () => {
    const result = validateCompanionUrl('http://169.254.169.254/latest/meta-data/', {
      source: '--follow',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/169\.254\.169\.254/);
    }
  });

  test('validateCompanionUrl warns on remote hosts unless allowRemote', () => {
    const blocked = validateCompanionUrl('https://example.com', { source: 'dev.url' });
    expect(blocked.ok).toBe(true);
    if (blocked.ok) {
      expect(blocked.warnings.length).toBeGreaterThan(0);
    }

    const allowed = validateCompanionUrl('https://example.com', {
      source: 'dev.url',
      allowRemote: true,
    });
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.warnings).toHaveLength(0);
    }
  });
});
