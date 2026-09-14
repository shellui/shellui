import { describe, expect, it } from 'vitest';
import { CHROME_ACTIONS_MAX_TRAILING, CHROME_ACTIONS_VISIBLE_TRAILING } from '../types.js';
import { clampChromeActions } from './clampChromeActions.js';

describe('clampChromeActions', () => {
  it('serializes a full spec and collects callback ids', () => {
    const { payload, callbackIds, warnings } = clampChromeActions({
      back: { id: 'back', onClick: () => undefined },
      title: 'Inbox',
      trailing: [
        { id: 'edit', label: 'Edit', onClick: () => undefined },
        { id: 'share', icon: 'share', onClick: () => undefined },
      ],
      primary: { id: 'compose', icon: 'plus', label: 'New', onClick: () => undefined },
    });

    expect(warnings).toEqual([]);
    expect(payload).toEqual({
      back: { id: 'back' },
      title: 'Inbox',
      trailing: [
        { id: 'edit', label: 'Edit' },
        { id: 'share', icon: 'share' },
      ],
      primary: { id: 'compose', icon: 'plus', label: 'New' },
    });
    expect(callbackIds).toEqual(['back', 'edit', 'share', 'compose']);
  });

  it('normalizes title objects and skips empty titles', () => {
    expect(clampChromeActions({ title: { text: '  Hello  ' } }).payload.title).toBe('Hello');
    expect(clampChromeActions({ title: '   ' }).payload.title).toBeUndefined();
    expect(clampChromeActions({ title: { text: '' } }).payload.title).toBeUndefined();
  });

  it('skips items without id (blunt failure)', () => {
    const { payload, warnings } = clampChromeActions({
      back: { id: '', onClick: () => undefined },
      trailing: [
        { id: '  ', label: 'Nope' },
        { id: 'ok', label: 'Ok' },
      ],
      primary: { id: '', icon: 'plus' },
    });
    expect(payload.back).toBeUndefined();
    expect(payload.primary).toBeUndefined();
    expect(payload.trailing).toEqual([{ id: 'ok', label: 'Ok' }]);
    expect(warnings.some((w) => w.includes('missing a non-empty id'))).toBe(true);
  });

  it('caps trailing at CHROME_ACTIONS_MAX_TRAILING', () => {
    const trailing = Array.from({ length: CHROME_ACTIONS_MAX_TRAILING + 3 }, (_, i) => ({
      id: `t${i}`,
      label: `T${i}`,
    }));
    const { payload, warnings } = clampChromeActions({ trailing });
    expect(payload.trailing).toHaveLength(CHROME_ACTIONS_MAX_TRAILING);
    expect(warnings.some((w) => w.includes('capped'))).toBe(true);
  });

  it('documents visible trailing constant used by host overflow', () => {
    expect(CHROME_ACTIONS_VISIBLE_TRAILING).toBe(3);
  });

  it('rejects duplicate ids across slots', () => {
    const { payload, warnings } = clampChromeActions({
      back: { id: 'same' },
      trailing: [
        { id: 'same', label: 'Dup' },
        { id: 'other', label: 'Other' },
      ],
      primary: { id: 'same', icon: 'plus' },
    });
    expect(payload.back).toEqual({ id: 'same' });
    expect(payload.trailing).toEqual([{ id: 'other', label: 'Other' }]);
    expect(payload.primary).toBeUndefined();
    expect(
      warnings.filter((w) => w.includes('duplicate') || w.includes('collides')).length,
    ).toBeGreaterThan(0);
  });

  it('returns empty payload for nullish input', () => {
    expect(clampChromeActions(undefined).payload).toEqual({});
    expect(clampChromeActions(null).payload).toEqual({});
  });
});
