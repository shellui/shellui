import { describe, expect, it, vi } from 'vitest';
import { shareInFlight, type InFlightSlot } from './shareInFlight';

describe('shareInFlight', () => {
  it('runs once and shares the same promise for concurrent callers', async () => {
    const slot: InFlightSlot<string> = { current: null };
    const run = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 'ok';
    });

    const [a, b] = await Promise.all([shareInFlight(slot, run), shareInFlight(slot, run)]);

    expect(a).toBe('ok');
    expect(b).toBe('ok');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('allows a new run after the previous promise settles', async () => {
    const slot: InFlightSlot<number> = { current: null };
    const run = vi.fn(async () => 1);

    await shareInFlight(slot, run);
    await shareInFlight(slot, run);

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('clears the slot after rejection so a later caller can retry', async () => {
    const slot: InFlightSlot<string> = { current: null };
    const failing = vi.fn(async () => {
      throw new Error('boom');
    });
    const succeeding = vi.fn(async () => 'recovered');

    await expect(shareInFlight(slot, failing)).rejects.toThrow('boom');
    await expect(shareInFlight(slot, succeeding)).resolves.toBe('recovered');
    expect(failing).toHaveBeenCalledTimes(1);
    expect(succeeding).toHaveBeenCalledTimes(1);
  });
});
