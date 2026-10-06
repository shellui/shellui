import { describe, expect, it } from 'vitest';
import { isAiFeatureEnabled } from './isAiFeatureEnabled.js';

describe('isAiFeatureEnabled', () => {
  it('defaults to false when config.ai or ai.enabled is omitted', () => {
    expect(isAiFeatureEnabled(undefined)).toBe(false);
    expect(isAiFeatureEnabled({})).toBe(false);
    expect(isAiFeatureEnabled({ ai: {} })).toBe(false);
  });

  it('is true only when config.ai.enabled is explicitly true', () => {
    expect(isAiFeatureEnabled({ ai: { enabled: true } })).toBe(true);
    expect(isAiFeatureEnabled({ ai: { enabled: false } })).toBe(false);
  });
});
