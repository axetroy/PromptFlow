import { useEffect } from 'react';

/**
 * Listen for a keyboard shortcut (one or more keys combined).
 *
 * Calls `callback` when **all** keys in the `keys` array are pressed
 * simultaneously. Supports modifier keys: `ctrl`, `shift`, `alt`, `meta`.
 *
 * @example
 * ```ts
 * useKeyboardShortcut(['ctrl', 'k'], () => openCommandPalette());
 * useKeyboardShortcut(['Escape'], () => closePanel(), { preventDefault: true });
 * ```
 *
 * @param keys    - List of keys. Regular keys are compared against `event.key`.
 *                 Modifier keys (`ctrl`, `shift`, `alt`, `meta`) check the
 *                 corresponding `event.ctrlKey` etc.
 * @param callback - Handler invoked when all keys are pressed
 * @param options  - `preventDefault` calls `event.preventDefault()` if true
 */
export function useKeyboardShortcut(
  keys: string[],
  callback: (event: KeyboardEvent) => void,
  options: { preventDefault?: boolean } = {}
): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const allKeysPressed = keys.every((key) => {
        if (key === 'ctrl') return event.ctrlKey;
        if (key === 'shift') return event.shiftKey;
        if (key === 'alt') return event.altKey;
        if (key === 'meta') return event.metaKey;
        return event.key === key;
      });

      if (allKeysPressed) {
        if (options.preventDefault) {
          event.preventDefault();
        }
        callback(event);
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [keys, callback, options.preventDefault]);
}
