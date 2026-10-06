import { describe, expect, it } from 'vitest';
import { buildAiDisabledResponse } from './aiDisabledResponses.js';

describe('buildAiDisabledResponse', () => {
  it('returns unavailable for availability', () => {
    expect(buildAiDisabledResponse({ id: '1', op: 'availability' })).toEqual({
      id: '1',
      data: { availability: 'unavailable' },
    });
  });

  it('returns empty models for listModels', () => {
    expect(buildAiDisabledResponse({ id: '2', op: 'listModels' })).toEqual({
      id: '2',
      data: { models: [] },
    });
  });

  it('returns ai_disabled for create/prompt', () => {
    expect(buildAiDisabledResponse({ id: '3', op: 'create' })).toMatchObject({
      id: '3',
      error: { code: 'ai_disabled' },
    });
    expect(buildAiDisabledResponse({ id: '4', op: 'prompt', prompt: 'hi' })).toMatchObject({
      id: '4',
      error: { code: 'ai_disabled' },
    });
  });
});
