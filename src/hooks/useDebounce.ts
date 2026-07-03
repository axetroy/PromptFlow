import { useState, useEffect } from 'react';

/**
 * Debounce a value.
 *
 * Returns a debounced copy of `value` that only updates after `delay`ms
 * of inactivity. Useful for delaying expensive work (e.g. API calls,
 * filtering) while the user is still typing.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
