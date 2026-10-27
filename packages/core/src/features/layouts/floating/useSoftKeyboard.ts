import { useEffect } from 'react';

/** Root attribute set while the phone soft keyboard covers the bottom of the shell. */
export const SOFT_KEYBOARD_ATTR = 'data-shellui-keyboard';

/** The visual viewport must shrink by more than this before we call it a keyboard. */
export const SOFT_KEYBOARD_MIN_PX = 120;

/** Focus that can raise a soft keyboard: text fields, contenteditable, or a content iframe. */
export function isEditableFocus(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  // Keyboard inside a content frame: the shell only sees the iframe as active.
  if (tag === 'IFRAME') return true;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    return ![
      'button',
      'checkbox',
      'color',
      'file',
      'hidden',
      'image',
      'radio',
      'range',
      'reset',
      'submit',
    ].includes(type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

/** Pure check, kept separate for tests. */
export function isSoftKeyboardOpen(
  visualHeight: number,
  innerHeight: number,
  active: Element | null,
): boolean {
  if (!(visualHeight > 0) || !(innerHeight > 0)) return false;
  return innerHeight - visualHeight > SOFT_KEYBOARD_MIN_PX && isEditableFocus(active);
}

/**
 * Phones: hide the floating dock and FAB while the soft keyboard is open so the
 * focused field keeps the space. Sets `html[data-shellui-keyboard="open"]`.
 */
export function useSoftKeyboard(enabled: boolean): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    if (!enabled || !vv) {
      root.removeAttribute(SOFT_KEYBOARD_ATTR);
      return;
    }

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const open = isSoftKeyboardOpen(vv.height, window.innerHeight, document.activeElement);
        if (open) root.setAttribute(SOFT_KEYBOARD_ATTR, 'open');
        else root.removeAttribute(SOFT_KEYBOARD_ATTR);
      });
    };

    vv.addEventListener('resize', update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', update);
    window.addEventListener('blur', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', update);
      window.removeEventListener('blur', update);
      root.removeAttribute(SOFT_KEYBOARD_ATTR);
    };
  }, [enabled]);
}
