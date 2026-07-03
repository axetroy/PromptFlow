import { useState, useEffect, useRef } from 'react';

/**
 * Keyboard navigation for the prompt list.
 *
 * Listens for `ArrowDown`, `ArrowUp` and `Enter` keys on the panel
 * element and manages `selectedIndex` / `hoveredIndex` state.
 * The `onEnter` callback is kept up-to-date via a ref so the keyboard
 * listener never goes stale.
 *
 * @param panelRef - Ref to the panel container (event target for keydown)
 * @param listRef  - Ref to the prompt list container (used to query items)
 * @param onEnter  - Called when Enter is pressed on a selected item
 */
export function usePromptKeyboardNav(
  panelRef: React.RefObject<HTMLDivElement | null>,
  listRef: React.RefObject<HTMLDivElement | null>,
  onEnter: () => void,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const onEnterRef = useRef(onEnter);

  useEffect(() => {
    onEnterRef.current = onEnter;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const list = listRef.current;
      if (!list) return;
      const items = Array.from(list.querySelectorAll('.prompt-item'));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => {
          const next = Math.min(prev + 1, items.length - 1);
          items[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          items[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onEnterRef.current();
      }
    };

    panel.addEventListener('keydown', handleKeyDown);
    return () => panel.removeEventListener('keydown', handleKeyDown);
  }, [panelRef, listRef]);

  return { selectedIndex, setSelectedIndex, hoveredIndex, setHoveredIndex };
}
