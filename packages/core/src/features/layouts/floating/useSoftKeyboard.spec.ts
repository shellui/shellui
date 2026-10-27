// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { isEditableFocus, isSoftKeyboardOpen, SOFT_KEYBOARD_MIN_PX } from './useSoftKeyboard';

const el = (html: string) => {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  return wrap.firstElementChild;
};

describe('isEditableFocus', () => {
  it('accepts text fields, textareas, contenteditable and content frames', () => {
    expect(isEditableFocus(el('<input type="text">'))).toBe(true);
    expect(isEditableFocus(el('<input type="search">'))).toBe(true);
    expect(isEditableFocus(el('<textarea></textarea>'))).toBe(true);
    expect(isEditableFocus(el('<iframe></iframe>'))).toBe(true);
  });

  it('rejects buttons, checkboxes and plain elements', () => {
    expect(isEditableFocus(el('<input type="checkbox">'))).toBe(false);
    expect(isEditableFocus(el('<button></button>'))).toBe(false);
    expect(isEditableFocus(el('<div></div>'))).toBe(false);
    expect(isEditableFocus(null)).toBe(false);
  });
});

describe('isSoftKeyboardOpen', () => {
  const input = el('<input type="text">');

  it('opens when the visual viewport shrinks past the threshold with a field focused', () => {
    expect(isSoftKeyboardOpen(500, 844, input)).toBe(true);
  });

  it('stays closed for small changes (URL bar) or without an editable focus', () => {
    expect(isSoftKeyboardOpen(844 - SOFT_KEYBOARD_MIN_PX, 844, input)).toBe(false);
    expect(isSoftKeyboardOpen(500, 844, el('<button></button>'))).toBe(false);
    expect(isSoftKeyboardOpen(0, 844, input)).toBe(false);
  });
});
