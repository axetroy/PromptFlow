import { useEffect, useRef } from 'react';

/**
 * Track the previous value of a variable.
 *
 * Returns `undefined` on the first render, then the value from the
 * previous render cycle on subsequent renders.
 *
 * @param value - The value to track
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  // eslint-disable-next-line react-hooks/refs
  return ref.current;
}
