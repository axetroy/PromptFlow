/**
 * Shared Shadow DOM mount/unmount helpers for content-script UI components.
 *
 * Both PromptPanel and VariableInputModal follow the same lifecycle:
 *   1. Create a host <div> on document.body
 *   2. Attach a Shadow DOM root
 *   3. Inject a <link> stylesheet
 *   4. Create a React root inside the shadow
 *   5. Render the component
 *   6. On cleanup, unmount the React root and remove the host
 *
 * This module extracts that boilerplate.
 */

import { createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export interface ShadowMount {
  root: Root;
  host: HTMLElement;
}

/**
 * Get the effective theme based on user's theme setting and system preference.
 */
export function getEffectiveTheme(): 'light' | 'dark' {
  const STORAGE_KEY = 'promptflow-data';
  
  // Default to system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let themeSetting = 'system';
  
  // Read from storage synchronously using a sync getter if available
  try {
    const result = (chrome.storage.local as unknown as { getSync: (key: string) => Record<string, unknown> | undefined }).getSync?.(STORAGE_KEY);
    if (result && typeof result === 'object') {
      const settings = (result as Record<string, unknown>).settings as Record<string, unknown> | undefined;
      if (settings) {
        themeSetting = (settings.theme as string) || 'system';
      }
    }
  } catch {
    // Fallback to system preference
  }
  
  if (themeSetting === 'system') {
    return prefersDark ? 'dark' : 'light';
  }
  return themeSetting as 'light' | 'dark';
}

/**
 * Mount a React component inside a Shadow DOM host element.
 *
 * @param id          - Unique id for the host element (e.g. 'promptflow-panel-host')
 * @param cssFileName - CSS file name served by the extension (e.g. 'PromptPanel.css')
 * @param hostStyle   - Inline CSS for the host element
 * @param Component   - React component to render
 * @param props       - Props to pass to the component
 * @param theme       - Theme class to apply ('light' or 'dark'), defaults to system preference
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountShadowComponent<P extends Record<string, any>>(
  id: string,
  cssFileName: string,
  hostStyle: string,
  Component: ComponentType<P>,
  props: P,
  theme?: 'light' | 'dark',
): ShadowMount {
  const host = document.createElement('div');
  host.id = id;
  host.style.cssText = hostStyle;
  
  // Apply theme class to host element
  const effectiveTheme = theme || getEffectiveTheme();
  host.classList.add(effectiveTheme);
  
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = chrome.runtime.getURL(cssFileName);
  shadowRoot.appendChild(linkEl);

  const container = document.createElement('div');
  shadowRoot.appendChild(container);

  const root = createRoot(container);
  root.render(createElement(Component, props));

  return { root, host };
}

/**
 * Unmount a previously mounted shadow component.
 */
export function unmountShadowComponent(mount: ShadowMount | null): null {
  if (!mount) return null;
  mount.root.unmount();
  mount.host.remove();
  return null;
}
