import { useState, useCallback } from 'react';

/**
 * Boolean toggle with convenience helpers.
 *
 * Returns a tuple `[value, toggle, setValue]`:
 * - `value` – current boolean state
 * - `toggle` – flips the value
 * - `setValue` – imperative setter (same as useState)
 *
 * @param initialValue - Initial state (default `false`)
 */
export function useToggle(
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  return [value, toggle, setValue];
}
