import { useState, useEffect, useCallback, useLayoutEffect } from 'react';

const PANEL_WIDTH = 620;
const PANEL_MAX_HEIGHT = 520;

/**
 * Position a fixed panel centred in the viewport and keep it
 * positioned correctly on scroll / resize.
 *
 * Designed for use with Shadow DOM: the hook writes `top` and `left`
 * directly onto the **host element** (the shadow root's host), which
 * is the element that holds `position: fixed` in its inline style.
 *
 * The panel's `maxHeight` is capped at `PANEL_MAX_HEIGHT` and clamped
 * to a minimum of 200 px to account for available viewport space.
 *
 * @param panelRef - A ref attached to the panel's root `<div>` inside
 *                   the Shadow DOM. Used to reach the host element via
 *                   `node.getRootNode().host`.
 */
export function usePanelPosition(panelRef: React.RefObject<HTMLDivElement | null>) {
  const calc = useCallback(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const top = vh * 0.05;
    const left = (vw - PANEL_WIDTH) / 2;
    const maxHeight = Math.min(Math.max(200, vh - top - 20), PANEL_MAX_HEIGHT);
    return { top, left, maxHeight };
  }, []);

  const [pos, setPos] = useState(calc);

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    const host = (panelRef.current.getRootNode() as ShadowRoot).host as HTMLElement;
    if (host) {
      host.style.top = `${pos.top}px`;
      host.style.left = `${pos.left}px`;
    }
  }, [pos, panelRef]);

  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const debounced = () => {
      clearTimeout(id);
      id = setTimeout(() => setPos(calc()), 50);
    };
    document.addEventListener('scroll', debounced, true);
    window.addEventListener('resize', debounced);
    return () => {
      document.removeEventListener('scroll', debounced, true);
      window.removeEventListener('resize', debounced);
    };
  }, [calc]);

  return pos;
}
