import { useEffect, useCallback, useRef } from 'react';

/**
 * Debounce a callback function.
 *
 * Returns a debounced version of `callback` that delays invocation
 * until `delay`ms after the last call. The returned function is
 * referentially stable (memoized via useCallback).
 *
 * @param callback - The function to debounce
 * @param delay    - Delay in milliseconds
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  return debouncedCallback;
}
