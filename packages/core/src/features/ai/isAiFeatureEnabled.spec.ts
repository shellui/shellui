import { describe, expect, it } from 'vitest';
import { isAiFeatureEnabled } from './isAiFeatureEnabled.js';

describe('isAiFeatureEnabled', () => {
  it('defaults to true when config.ai is omitted', () => {
    expect(isAiFeatureEnabled(undefined)).toBe(true);
    expect(isAiFeatureEnabled({})).toBe(true);
    expect(isAiFeatureEnabled({ ai: {} })).toBe(true);
  });

  it('is false only when config.ai.enabled is explicitly false', () => {
    expect(isAiFeatureEnabled({ ai: { enabled: false } })).toBe(false);
    expect(isAiFeatureEnabled({ ai: { enabled: true } })).toBe(true);
  });
});
