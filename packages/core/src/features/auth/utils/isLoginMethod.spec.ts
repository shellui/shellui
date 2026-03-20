import { describe, expect, it } from 'vitest';
import { isLoginMethod } from './isLoginMethod';

describe('isLoginMethod', () => {
  it('returns true for supported auth methods', () => {
    expect(isLoginMethod('password')).toBe(true);
    expect(isLoginMethod('oauth')).toBe(true);
    expect(isLoginMethod('magic_link')).toBe(true);
    expect(isLoginMethod('web3')).toBe(true);
  });

  it('returns false for unsupported values', () => {
    expect(isLoginMethod('sms')).toBe(false);
    expect(isLoginMethod(null)).toBe(false);
    expect(isLoginMethod(undefined)).toBe(false);
    expect(isLoginMethod(123)).toBe(false);
  });
});
