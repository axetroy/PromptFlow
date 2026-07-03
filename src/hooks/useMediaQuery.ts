import { useState, useEffect } from 'react';

/**
 * Reactive media query matcher.
 *
 * Returns `true` when the document matches the given CSS media query
 * string, and automatically updates when the match state changes
 * (e.g. window resize, print mode, reduced motion).
 *
 * @example
 * ```ts
 * const isWide = useMediaQuery('(min-width: 768px)');
 * ```
 *
 * @param query - A CSS media query string (e.g. `'(prefers-color-scheme: dark)'`)
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
