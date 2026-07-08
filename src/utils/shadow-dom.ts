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
import { getEffectiveThemeSync } from '../hooks';

export interface ShadowMount {
  root: Root;
  host: HTMLElement;
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
  
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = chrome.runtime.getURL(cssFileName);
  shadowRoot.appendChild(linkEl);

  // Apply theme class to the container inside shadow DOM
  const effectiveTheme = theme || getEffectiveThemeSync();
  const container = document.createElement('div');
  container.classList.add(effectiveTheme);
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
