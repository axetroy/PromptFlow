import { useState, useEffect } from 'react';

/**
 * Track whether a specific keyboard key is currently pressed.
 *
 * Listens to `keydown`/`keyup` on `window`. Returns `true` while the
 * key is held down, `false` when released.
 *
 * @param targetKey - The `event.key` value to watch (e.g. `'Escape'`, `'a'`)
 */
export function useKeyPress(targetKey: string): boolean {
  const [keyPressed, setKeyPressed] = useState(false);

  useEffect(() => {
    const downHandler = (event: KeyboardEvent) => {
      if (event.key === targetKey) {
        setKeyPressed(true);
      }
    };

    const upHandler = (event: KeyboardEvent) => {
      if (event.key === targetKey) {
        setKeyPressed(false);
      }
    };

    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);

    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [targetKey]);

  return keyPressed;
}
