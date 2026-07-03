import { useState, useEffect, useRef } from 'react';

/**
 * Observe element visibility via IntersectionObserver.
 *
 * Returns a ref to attach to the target element and a boolean that
 * indicates whether the element is currently intersecting the viewport
 * (or the configured root).
 *
 * @param options - Standard IntersectionObserver options
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting];
}
