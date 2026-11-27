import { describe, expect, it } from 'vitest';
import { shouldApplySettingsFromParent } from './parentSettingsMessage.js';

describe('shouldApplySettingsFromParent', () => {
  it('rejects settings when the parent origin is unknown', () => {
    expect(
      shouldApplySettingsFromParent({
        parentOrigin: null,
        sourceIsParent: true,
        eventOrigin: 'https://evil.example',
      }),
    ).toBe(false);
  });

  it('rejects an opaque or wildcard parent origin', () => {
    expect(
      shouldApplySettingsFromParent({
        parentOrigin: 'null',
        sourceIsParent: true,
        eventOrigin: 'null',
      }),
    ).toBe(false);
    expect(
      shouldApplySettingsFromParent({
        parentOrigin: '*',
        sourceIsParent: true,
        eventOrigin: '*',
      }),
    ).toBe(false);
  });

  it('rejects a message that is not from window.parent', () => {
    expect(
      shouldApplySettingsFromParent({
        parentOrigin: 'http://localhost:4000',
        sourceIsParent: false,
        eventOrigin: 'http://localhost:4000',
      }),
    ).toBe(false);
  });

  it('rejects the companion origin when the parent origin is different', () => {
    expect(
      shouldApplySettingsFromParent({
        parentOrigin: 'http://localhost:4000',
        sourceIsParent: true,
        eventOrigin: 'http://localhost:5173',
      }),
    ).toBe(false);
  });

  it('accepts the parent window at the verified parent origin', () => {
    expect(
      shouldApplySettingsFromParent({
        parentOrigin: 'http://localhost:4000',
        sourceIsParent: true,
        eventOrigin: 'http://localhost:4000',
      }),
    ).toBe(true);
  });
});
