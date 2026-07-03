import { useEffect, useRef } from 'react';

/**
 * Detect clicks outside a referenced element.
 *
 * Attaches a `mousedown` listener on `document` and calls `callback`
 * when the click occurs outside the element returned via `ref`.
 *
 * @example
 * ```tsx
 * const ref = useClickOutside<HTMLDivElement>(() => closePanel());
 * return <div ref={ref}>...</div>;
 * ```
 *
 * @param callback - Fired when a click outside the element is detected
 */
export function useClickOutside<T extends HTMLElement>(
  callback: () => void
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [callback]);

  return ref;
}
