import { describe, expect, it } from 'vitest';
import { getBrowserTimezone } from './getBrowserTimezone';

describe('getBrowserTimezone', () => {
  it('returns a non-empty timezone string', () => {
    const timezone = getBrowserTimezone();

    expect(typeof timezone).toBe('string');
    expect(timezone.length).toBeGreaterThan(0);
  });
});
