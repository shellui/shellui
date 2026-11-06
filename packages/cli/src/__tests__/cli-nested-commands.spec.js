import { describe, expect, test } from 'vitest';
import { isLikelyProjectRootPath, popOptionalRoot } from '../cli-nested-commands.js';

describe('popOptionalRoot', () => {
  test('treats trailing path-like token as root', () => {
    const r = popOptionalRoot(['list', './myapp']);
    expect(r.root).toBe('./myapp');
    expect(r.rest).toEqual(['list']);
  });

  test('keeps uuid as argument not root', () => {
    const id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const r = popOptionalRoot(['status', id]);
    expect(r.root).toBe('.');
    expect(r.rest).toEqual(['status', id]);
  });

  test('slug is not a root path', () => {
    const r = popOptionalRoot(['get', 'my-preview']);
    expect(r.root).toBe('.');
    expect(r.rest).toEqual(['get', 'my-preview']);
  });
});

describe('isLikelyProjectRootPath', () => {
  test('posix relative path', () => {
    expect(isLikelyProjectRootPath('./x')).toBe(true);
  });
  test('plain slug', () => {
    expect(isLikelyProjectRootPath('my-preview')).toBe(false);
  });
});
