import { Prompt, DEFAULT_SETTINGS, DEFAULT_PROMPTS } from './types';
import { showVariableInput, hideVariableInput, getUniqueVariables, interpolate, hasVariables } from './VariableInput';

interface ContentState {
  isPanelOpen: boolean;
  currentTrigger: string;
  currentInput: HTMLInputElement | HTMLTextAreaElement | Element | null;
  caretPosition: number;
  triggerStartPosition: number;
  selectedIndex: number;
  prompts: Prompt[];
  searchQuery: string;
  pendingPrompt: Prompt | null; // Prompt waiting for variable input
}

const state: ContentState = {
  isPanelOpen: false,
  currentTrigger: DEFAULT_SETTINGS.trigger,
  currentInput: null,
  caretPosition: 0,
  triggerStartPosition: 0,
  selectedIndex: 0,
  prompts: [],
  searchQuery: '',
  pendingPrompt: null,
};

let panelContainer: HTMLElement | null = null;

// Detect system theme preference
function getCurrentTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

interface StorageData {
  prompts?: Prompt[];
  settings?: {
    trigger?: string;
    theme?: 'light' | 'dark' | 'auto';
  };
}

async function loadSettings(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['promptflow-data'], (result) => {
      const data = result['promptflow-data'] as StorageData | undefined;
      if (data?.settings) {
        if (data.settings.trigger) {
          state.currentTrigger = data.settings.trigger;
        }
      }
      resolve();
    });
  });
}

async function loadPrompts(): Promise<Prompt[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['promptflow-data'], (result) => {
      const data = result['promptflow-data'] as { 
        customPrompts?: Prompt[]; 
        disabledDefaultIds?: string[];
        syncedRepos?: SyncedRepo[];
        syncedPrompts?: SyncedPrompt[];
        settings?: any;
      } | undefined;
      
      // Get custom prompts and disabled default IDs
      const customPrompts: Prompt[] = data?.customPrompts || [];
      const disabledDefaultIds: string[] = data?.disabledDefaultIds || [];
      const syncedRepos: SyncedRepo[] = data?.syncedRepos || [];
      const syncedPrompts: SyncedPrompt[] = data?.syncedPrompts || [];
      
      // Merge default prompts with custom prompts
      const allPrompts: Prompt[] = [];
      
      // Add default prompts (sorted by ID), excluding disabled ones
      const sortedDefaults = [...DEFAULT_PROMPTS]
        .sort((a, b) => a.id.localeCompare(b.id))
        .filter(p => !disabledDefaultIds.includes(p.id));
      
      allPrompts.push(...sortedDefaults);
      
      // Add custom prompts that are enabled
      allPrompts.push(...customPrompts.filter(p => p.enabled !== false));
      
      // Add synced prompts (only enabled ones from enabled repos)
      const enabledRepoIds = new Set(
        syncedRepos.filter(r => r.enabled).map(r => r.id)
      );
      
      const enabledSyncedPrompts = syncedPrompts
        .filter(p => 
          enabledRepoIds.has(p.repoId) && 
          p.enabled !== false
        );
      
      allPrompts.push(...enabledSyncedPrompts);
      
      resolve(allPrompts);
    });
  });
}

// Types for synced prompts (duplicated to avoid circular imports)
interface SyncedRepo {
  id: string;
  repo: string;
  branch: string;
  promptsPath: string;
  lastSyncedAt?: number;
  enabled: boolean;
  enabledPromptIds: string[];
}

interface SyncedPrompt {
  id: string;
  repoId: string;
  title: string;
  content: string;
  description?: string;
  tags: string[];
  filePath: string;
  createdAt: number;
  updatedAt: number;
  enabled?: boolean;
}

function getInputValue(input: HTMLInputElement | HTMLTextAreaElement | Element): string {
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    return input.value || '';
  }
  if (input.hasAttribute('contenteditable')) {
    return input.textContent || '';
  }
  return '';
}

function getCaretPosition(input: HTMLInputElement | HTMLTextAreaElement | Element): number {
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    return input.selectionStart || 0;
  }
  if (input.hasAttribute('contenteditable')) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(input);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      return preCaretRange.toString().length;
    }
  }
  return 0;
}

function getCaretRect(input: HTMLInputElement | HTMLTextAreaElement | Element): DOMRect | null {
  // contenteditable elements - use selection range rect
  if (input.hasAttribute('contenteditable')) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        return rects[rects.length - 1];
      }
      return range.getBoundingClientRect();
    }
    return null;
  }
  
  // For input/textarea, use a mirror div technique
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    const inputRect = input.getBoundingClientRect();
    const pos = input.selectionStart || 0;
    
    // Create a mirror div with same styling
    const mirror = document.createElement('div');
    const style = getComputedStyle(input);
    
    // Copy essential styles
    const props = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
      'letterSpacing', 'lineHeight', 'textTransform',
      'borderWidth', 'borderStyle', 'borderColor',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'boxSizing', 'wordBreak'
    ];
    
    props.forEach(prop => {
      mirror.style.setProperty(prop, style.getPropertyValue(prop === 'borderWidth' ? 'border-width' : 
        prop === 'borderStyle' ? 'border-style' : 
        prop === 'borderColor' ? 'border-color' : 
        prop === 'boxSizing' ? 'box-sizing' : 
        prop === 'wordBreak' ? 'word-break' : prop));
    });
    
    mirror.style.position = 'absolute';
    mirror.style.top = '-9999px';
    mirror.style.left = '-9999px';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflow = 'hidden';
    mirror.style.width = inputRect.width + 'px';
    
    // Add text before caret
    const textBefore = input.value.substring(0, pos);
    const textAfter = input.value.substring(pos);
    
    // Create span at caret position
    mirror.innerHTML = escapeHtml(textBefore) + '<span id="caret-span">|</span>' + escapeHtml(textAfter);
    document.body.appendChild(mirror);
    
    const caretSpan = document.getElementById('caret-span');
    let rect: DOMRect | null = null;
    
    if (caretSpan) {
      rect = caretSpan.getBoundingClientRect();
      // Create a new rect relative to viewport
      rect = new DOMRect(
        rect.left,
        rect.top,
        0, // caret width is 0
        rect.height
      );
    }
    
    document.body.removeChild(mirror);
    return rect;
  }
  
  return null;
}

function setCaretPosition(input: HTMLInputElement | HTMLTextAreaElement | Element, position: number): void {
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    input.setSelectionRange(position, position);
    input.focus();
  } else if (input.hasAttribute('contenteditable')) {
    const range = document.createRange();
    const selection = window.getSelection();
    let charCount = 0;
    let found = false;

    function traverseNodes(node: Node): void {
      if (found) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCount = charCount + node.textContent!.length;
        if (position <= nextCount) {
          range.setStart(node, position - charCount);
          range.setEnd(node, position - charCount);
          found = true;
        }
        charCount = nextCount;
      } else {
        for (const child of Array.from(node.childNodes)) {
          traverseNodes(child);
          if (found) break;
        }
      }
    }

    traverseNodes(input);
    if (!found) {
      range.selectNodeContents(input);
      range.collapse(false);
    }
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}


function findTriggerPosition(inputValue: string, caretPos: number, trigger: string): number {
  const textBeforeCaret = inputValue.substring(0, caretPos);
  
  // Find the trigger - must be at word boundary (start of text or after space/newline/punctuation)
  let lastIndex = -1;
  
  // Find all occurrences and check word boundaries
  let searchStart = 0;
  while (true) {
    const found = textBeforeCaret.indexOf(trigger, searchStart);
    if (found === -1) break;
    
    // Check if it's at a word boundary
    const isWordBoundary = found === 0 || 
      /\s/.test(textBeforeCaret[found - 1]) ||
      /[\(\[\{]/.test(textBeforeCaret[found - 1]);
    
    if (isWordBoundary) {
      lastIndex = found;
    }
    
    searchStart = found + 1;
  }
  
  if (lastIndex === -1) return -1;

  // Check that the trigger is complete (no partial matches like /pa for /p)
  const textAfterTrigger = textBeforeCaret.substring(lastIndex + trigger.length);
  
  // CRITICAL: The cursor must be IMMEDIATELY after the trigger
  // Examples:
  // - "/prompts" with cursor at 8 → MATCH (cursor right after trigger)
  // - "/prompts " with cursor at 9 → NO MATCH (space between trigger end and cursor)
  // - "/prompts a" with cursor at 10 → NO MATCH (character 'a' after trigger)
  
  const triggerEndPosition = lastIndex + trigger.length;
  
  // If cursor is past the trigger, check what's between them
  if (textBeforeCaret.length > triggerEndPosition) {
    // There's text between trigger end and cursor
    // If there's ANY whitespace there, the cursor is not at the trigger
    const textBetween = textBeforeCaret.substring(triggerEndPosition);
    if (textBetween.trim().length > 0) {
      // Non-whitespace content between trigger and cursor - partial match
      return -1;
    }
    // There's whitespace between trigger and cursor - cursor is not at trigger
    return -1;
  }
  
  // Cursor is at or before trigger end - this is a match
  return lastIndex;
}


function createPanel(): HTMLElement {
  const container = document.createElement('div');
  // Use system theme as default, default to light theme
  const theme = getCurrentTheme()
  const isDark = theme === 'dark';
  container.id = 'promptflow-panel-container';
  container.classList.add(isDark ? 'dark' : 'light');
  container.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  document.body.appendChild(container);
  
  // Load React panel with current theme
  loadPanelApp(container, theme);
  
  return container;
}

async function loadPanelApp(container: HTMLElement, theme?: 'light' | 'dark'): Promise<void> {
  // Create shadow DOM for style isolation
  const shadow = container.attachShadow({ mode: 'open' });
  
  // Load styles
  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = chrome.runtime.getURL('panel.css');
  shadow.appendChild(linkEl);
  
  // Create panel container with theme class
  const panelWrapper = document.createElement('div');
  panelWrapper.id = 'promptflow-panel';
  const currentTheme = theme || getCurrentTheme();
  if (currentTheme === 'dark') {
    panelWrapper.classList.add('dark');
  }
  shadow.appendChild(panelWrapper);
  
  // Create search input
  const searchContainer = document.createElement('div');
  searchContainer.style.cssText = `
    padding: 12px;
    border-bottom: 1px solid transparent;
  `;
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search prompts...';
  searchInput.id = 'promptflow-search';
  searchContainer.appendChild(searchInput);
  panelWrapper.appendChild(searchContainer);
  
  // Create prompt list
  const listContainer = document.createElement('div');
  listContainer.id = 'promptflow-list';
  panelWrapper.appendChild(listContainer);
  
  // Create footer
  const footer = document.createElement('div');
  footer.id = 'promptflow-footer';
  footer.innerHTML = `
    <div class="footer-hint">
      <span class="footer-key">↑↓</span> Navigate
      <span class="footer-key">Enter</span> Select
      <span class="footer-key">Esc</span> Close
    </div>
    <button id="promptflow-settings-btn">
        <svg viewBox="64 64 896 896" focusable="false" data-icon="setting" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d="M924.8 625.7l-65.5-56c3.1-19 4.7-38.4 4.7-57.8s-1.6-38.8-4.7-57.8l65.5-56a32.03 32.03 0 009.3-35.2l-.9-2.6a443.74 443.74 0 00-79.7-137.9l-1.8-2.1a32.12 32.12 0 00-35.1-9.5l-81.3 28.9c-30-24.6-63.5-44-99.7-57.6l-15.7-85a32.05 32.05 0 00-25.8-25.7l-2.7-.5c-52.1-9.4-106.9-9.4-159 0l-2.7.5a32.05 32.05 0 00-25.8 25.7l-15.8 85.4a351.86 351.86 0 00-99 57.4l-81.9-29.1a32 32 0 00-35.1 9.5l-1.8 2.1a446.02 446.02 0 00-79.7 137.9l-.9 2.6c-4.5 12.5-.8 26.5 9.3 35.2l66.3 56.6c-3.1 18.8-4.6 38-4.6 57.1 0 19.2 1.5 38.4 4.6 57.1L99 625.5a32.03 32.03 0 00-9.3 35.2l.9 2.6c18.1 50.4 44.9 96.9 79.7 137.9l1.8 2.1a32.12 32.12 0 0035.1 9.5l81.9-29.1c29.8 24.5 63.1 43.9 99 57.4l15.8 85.4a32.05 32.05 0 0025.8 25.7l2.7.5a449.4 449.4 0 00159 0l2.7-.5a32.05 32.05 0 0025.8-25.7l15.7-85a350 350 0 0099.7-57.6l81.3 28.9a32 32 0 0035.1-9.5l1.8-2.1c34.8-41.1 61.6-87.5 79.7-137.9l.9-2.6c4.5-12.3.8-26.3-9.3-35zM788.3 465.9c2.5 15.1 3.8 30.6 3.8 46.1s-1.3 31-3.8 46.1l-6.6 40.1 74.7 63.9a370.03 370.03 0 01-42.6 73.6L721 702.8l-31.4 25.8c-23.9 19.6-50.5 35-79.3 45.8l-38.1 14.3-17.9 97a377.5 377.5 0 01-85 0l-17.9-97.2-37.8-14.5c-28.5-10.8-55-26.2-78.7-45.7l-31.4-25.9-93.4 33.2c-17-22.9-31.2-47.6-42.6-73.6l75.5-64.5-6.5-40c-2.4-14.9-3.7-30.3-3.7-45.5 0-15.3 1.2-30.6 3.7-45.5l6.5-40-75.5-64.5c11.3-26.1 25.6-50.7 42.6-73.6l93.4 33.2 31.4-25.9c23.7-19.5 50.2-34.9 78.7-45.7l37.9-14.3 17.9-97.2c28.1-3.2 56.8-3.2 85 0l17.9 97 38.1 14.3c28.7 10.8 55.4 26.2 79.3 45.8l31.4 25.8 92.8-32.9c17 22.9 31.2 47.6 42.6 73.6L781.8 426l6.5 39.9zM512 326c-97.2 0-176 78.8-176 176s78.8 176 176 176 176-78.8 176-176-78.8-176-176-176zm79.2 255.2A111.6 111.6 0 01512 614c-29.9 0-58-11.7-79.2-32.8A111.6 111.6 0 01400 502c0-29.9 11.7-58 32.8-79.2C454 401.6 482.1 390 512 390c29.9 0 58 11.6 79.2 32.8A111.6 111.6 0 01624 502c0 29.9-11.7 58-32.8 79.2z">
          </path>
        </svg>
      Settings
    </button>
  `;
  panelWrapper.appendChild(footer);
  
  // Settings button click handler
  const settingsBtn = shadow.getElementById('promptflow-settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      closePanel();
      // Send message to background script to open settings
      chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' }).catch(() => {
        // Fallback: open settings in new tab
        window.open(chrome.runtime.getURL('settings.html'), '_blank');
      });
    });
  }
  
  // Load prompts and render
  const prompts = await loadPrompts();
  state.prompts = prompts;
  renderPromptList(shadow, prompts, '');
  
  // Focus search input
  setTimeout(() => searchInput.focus(), 50);
  
  // Event listeners
  searchInput.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    state.searchQuery = query;
    const filtered = prompts.filter(p => 
      p.title.toLowerCase().includes(query) ||
      p.content.toLowerCase().includes(query) ||
      p.tags.some(t => t.toLowerCase().includes(query))
    );
    state.prompts = filtered;
    state.selectedIndex = 0;
    renderPromptList(shadow, filtered, query);
  });

  // Keyboard navigation in search input
  searchInput.addEventListener('keydown', (e) => {
    const filteredPrompts = state.prompts;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        if (filteredPrompts.length > 0) {
          state.selectedIndex = Math.min(state.selectedIndex + 1, filteredPrompts.length - 1);
          updateSelection(shadow, state.selectedIndex);
          scrollToSelected(shadow);
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        if (filteredPrompts.length > 0) {
          state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
          updateSelection(shadow, state.selectedIndex);
          scrollToSelected(shadow);
        }
        break;
        
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (filteredPrompts[state.selectedIndex]) {
          selectPrompt(filteredPrompts[state.selectedIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        closePanel();
        break;
    }
  });
}

/**
 * Highlight search query in text by wrapping matches with <mark> tags
 */
function highlightText(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  
  const escapedText = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(`(${escapeRegExp(escapedQuery)})`, 'gi');
  return escapedText.replace(regex, '<mark>$1</mark>');
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderPromptList(shadow: ShadowRoot, prompts: Prompt[], searchQuery: string = ''): void {
  const listContainer = shadow.getElementById('promptflow-list');
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  if (prompts.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        No prompts found
      </div>
    `;
    return;
  }
  
  prompts.forEach((prompt, index) => {
    const item = document.createElement('div');
    item.className = 'prompt-item' + (index === state.selectedIndex ? ' selected' : '');
    
    item.innerHTML = `
      <div class="prompt-item-title">
        ${highlightText(prompt.title, searchQuery)}
      </div>
      <div class="prompt-item-description">
        ${highlightText(prompt.description || '', searchQuery)}
      </div>
      <div class="prompt-item-tags">
        ${prompt.tags.map(tag => `
          <span class="prompt-tag">${escapeHtml(tag)}</span>
        `).join('')}
      </div>
    `;
    
    item.addEventListener('click', () => selectPrompt(prompt));
    item.addEventListener('mouseenter', () => {
      state.selectedIndex = index;
      updateSelection(shadow, index);
    });
    
    listContainer.appendChild(item);
  });
}

function updateSelection(shadow: ShadowRoot, index: number): void {
  const items = shadow.querySelectorAll('#promptflow-list > .prompt-item');
  items.forEach((item, i) => {
    const el = item as HTMLElement;
    if (i === index) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Find the first placeholder in the content (e.g., {variable})
 */
function findFirstPlaceholder(content: string): { start: number; end: number } | null {
  const match = content.match(/\{[^}]+\}/);
  if (match && match.index !== undefined) {
    return {
      start: match.index,
      end: match.index + match[0].length
    };
  }
  return null;
}

/**
 * Set text selection range for input/textarea elements
 */
function setSelection(input: HTMLInputElement | HTMLTextAreaElement | Element, start: number, end: number): void {
  if (!input) return;
  
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    input.focus();
    input.setSelectionRange(start, end);
  } else if (input.hasAttribute && input.hasAttribute('contenteditable')) {
    const range = document.createRange();
    const selection = window.getSelection();
    let charCount = 0;
    let foundStart = false;
    let foundEnd = false;

    function traverseNodes(node: Node): void {
      if (foundStart && foundEnd) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeLength = node.textContent!.length;
        const nextCount = charCount + nodeLength;
        const offset = start - charCount;
        
        // Check if start position is within this text node
        // Only use this node if offset is within valid range (0 to nodeLength)
        if (!foundStart && offset >= 0 && offset <= nodeLength) {
          // If offset equals nodeLength, we need to move to next node
          if (offset === nodeLength) {
            // Don't set foundStart yet, will continue to next node
          } else {
            range.setStart(node, offset);
            foundStart = true;
          }
        }
        
        // Check if end position is within this text node
        const endOffset = end - charCount;
        if (foundStart && !foundEnd && endOffset >= 0 && endOffset <= nodeLength) {
          if (endOffset === nodeLength) {
            // Don't set foundEnd yet, will continue to next node
          } else {
            range.setEnd(node, endOffset);
            foundEnd = true;
          }
        }
        
        // If we're at the boundary of this node, continue to next
        if (!foundStart && offset > nodeLength) {
          foundStart = true;
          range.setStartAfter(node);
        }
        if (foundStart && !foundEnd && endOffset > nodeLength) {
          foundEnd = true;
          range.setEndBefore(node);
        }
        
        charCount = nextCount;
      } else {
        // For non-text nodes (like br), count as 1 character
        if (node.nodeName === 'BR') {
          const nextCount = charCount + 1;
          if (!foundStart && start === nextCount) {
            // Position is at the br, find next text node
            foundStart = true;
          }
          if (foundStart && !foundEnd && end === nextCount) {
            foundEnd = true;
          }
          charCount = nextCount;
        }
        
        for (const child of Array.from(node.childNodes)) {
          traverseNodes(child);
          if (foundStart && foundEnd) break;
        }
      }
    }

    traverseNodes(input);
    
    // Handle case where positions are at boundaries
    if (!foundStart || !foundEnd) {
      // Try to collapse to appropriate position
      const allTextNodes: Text[] = [];
      function collectTextNodes(node: Node): void {
        if (node.nodeType === Node.TEXT_NODE) {
          allTextNodes.push(node as Text);
        }
        for (const child of Array.from(node.childNodes)) {
          collectTextNodes(child);
        }
      }
      collectTextNodes(input);
      
      if (allTextNodes.length > 0) {
        if (!foundStart) {
          // Start at beginning of first text node
          range.setStart(allTextNodes[0], 0);
        }
        if (!foundEnd) {
          // End at end of last text node (or at start if no nodes)
          const lastNode = allTextNodes[allTextNodes.length - 1];
          if (start <= lastNode.textContent!.length) {
            range.setEnd(lastNode, start);
          } else {
            range.setEndAfter(lastNode);
          }
        }
      } else {
        // No text nodes, select entire contents
        range.selectNodeContents(input);
        range.collapse(false);
      }
    }
    
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

/**
 * Insert prompt into input with filled content (after variable interpolation)
 */
function insertPromptWithContent(prompt: Prompt, filledContent: string): void {
  if (!state.currentInput) {
    console.error('[PromptFlow] No current input to insert prompt');
    return;
  }
  
  // Get browser's display language
  const browserLang = navigator.language || 'en';
  const langCode = browserLang.split('-')[0];
  const langNames: Record<string, string> = {
    'zh': 'Chinese',
    'en': 'English',
    'ja': 'Japanese',
    'ko': 'Korean',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'id': 'Indonesian',
    'ms': 'Malay',
    'tr': 'Turkish',
    'pl': 'Polish',
    'nl': 'Dutch',
    'it': 'Italian',
    'uk': 'Ukrainian',
  };
  const langName = langNames[langCode] || 'English';
  
  // Append language instruction to prompt
  const languageInstruction = `\n\n---\n\nPlease prioritize responding in ${langName} if no language has been specified earlier in the conversation.`;
  const promptContent = filledContent + languageInstruction;
  
  const inputValue = getInputValue(state.currentInput);
  
  // Replace trigger with prompt content
  const before = inputValue.substring(0, state.triggerStartPosition);
  const after = inputValue.substring(state.caretPosition);
  const newValue = before + promptContent + after;
  
  // Position cursor at end of inserted text (before language instruction)
  const selectionStart = state.triggerStartPosition + filledContent.length;
  const selectionEnd = selectionStart;
  
  // Store reference to currentInput before closing panel
  const targetInput = state.currentInput;
  
  // Close panel first to avoid any interference
  closePanel(false, false);
  
  // For textarea, directly set value and selection synchronously
  if (targetInput instanceof HTMLTextAreaElement) {
    const textarea = targetInput;
    // Use native setter to bypass any framework overrides
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    nativeSetter.call(textarea, newValue);
    // Focus and set selection
    textarea.focus();
    // Use setTimeout to ensure focus is applied before setting selection
    setTimeout(() => {
      textarea.setSelectionRange(selectionStart, selectionEnd);
    }, 0);
    // Dispatch input event so frameworks can detect the change
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  
  if (targetInput instanceof HTMLInputElement) {
    targetInput.value = newValue;
    targetInput.focus();
    setTimeout(() => {
      setSelection(targetInput, selectionStart, selectionEnd);
    }, 0);
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (targetInput.hasAttribute && targetInput.hasAttribute('contenteditable')) {
    // For contenteditable, insert at position
    insertContentWithNewlines(targetInput, promptContent, filledContent.length, filledContent.length);
  }
}

/**
 * Select a prompt - checks for variables and shows input modal if needed
 */
function selectPrompt(prompt: Prompt): void {
  if (!state.currentInput) return;
  
  // Check if the prompt has template variables
  if (hasVariables(prompt.content)) {
    // Store the prompt
    state.pendingPrompt = prompt;
    
    // Store the trigger position for later use when inserting
    const triggerStart = state.triggerStartPosition;
    const caretPos = state.caretPosition;
    
    // Close panel but don't restore focus yet (variable modal will handle it)
    closePanel(false, false);
    
    // Show variable input modal
    showVariableInput({
      prompt: {
        id: prompt.id,
        title: prompt.title,
        content: prompt.content,
      },
      onConfirm: (filledContent: string) => {
        if (state.pendingPrompt) {
          // Restore the state values that might have been cleared
          state.currentInput = document.activeElement as HTMLInputElement | HTMLTextAreaElement | Element;
          state.triggerStartPosition = triggerStart;
          state.caretPosition = caretPos;
          insertPromptWithContent(state.pendingPrompt, filledContent);
          state.pendingPrompt = null;
        }
      },
      onCancel: () => {
        // Restore focus to input
        if (state.currentInput) {
          if (state.currentInput instanceof HTMLInputElement || state.currentInput instanceof HTMLTextAreaElement) {
            state.currentInput.focus();
            setCaretPosition(state.currentInput, caretPos);
          } else if (state.currentInput.hasAttribute && state.currentInput.hasAttribute('contenteditable')) {
            (state.currentInput as HTMLElement).focus();
            setCaretPosition(state.currentInput, caretPos);
          }
        }
        state.pendingPrompt = null;
      },
    });
  } else {
    // No variables, insert directly
    insertPromptWithContent(prompt, prompt.content);
  }
}

/**
 * Insert content into contenteditable element, properly handling newlines
 * Returns the actual text content length for selection calculation
 */
function insertContentWithNewlines(
  element: Element,
  content: string,
  selectionStart: number,
  selectionEnd: number
): void {
  // Clear the element
  element.textContent = '';
  
  // Insert the new content with proper newline handling
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      // Insert <br> for newlines between lines (including empty lines)
      element.appendChild(document.createElement('br'));
    }
    
    if (lines[i].length > 0) {
      element.appendChild(document.createTextNode(lines[i]));
    }
  }
  
  // Adjust selection positions to account for br tags
  // In content string, \n is 1 char, but in DOM, <br> is a separate node
  // We need to find the corresponding DOM position
  const adjustedStart = findDOMPosition(element, selectionStart);
  const adjustedEnd = findDOMPosition(element, selectionEnd);
  
  // Set selection using adjusted positions
  setSelectionAtPosition(element, adjustedStart, adjustedEnd);
}

/**
 * Find the DOM position (node + offset) corresponding to a character position in content
 * This accounts for <br> tags being separate nodes in the DOM
 */
function findDOMPosition(element: Element, targetCharPos: number): { node: Node; offset: number } | null {
  let charCount = 0;
  
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeLength = node.textContent!.length;
      
      // Check if target position is within this text node
      if (charCount <= targetCharPos && targetCharPos <= charCount + nodeLength) {
        return {
          node,
          offset: targetCharPos - charCount
        };
      }
      charCount += nodeLength;
    } else if (node.nodeName === 'BR') {
      // br tag represents a newline character in the content
      // If target is at this newline position, find next text node
      if (charCount === targetCharPos) {
        // Target is exactly at this br position
        // Move to next text node or return null
        const nextTextNode = findNextTextNode(element, node);
        if (nextTextNode) {
          return { node: nextTextNode, offset: 0 };
        }
      }
      charCount += 1; // br counts as 1 character in content
    }
  }
  
  // If position beyond all content, return end of last text node
  const lastTextNode = findLastTextNode(element);
  if (lastTextNode) {
    return { node: lastTextNode, offset: lastTextNode.textContent!.length };
  }
  
  return null;
}

function findNextTextNode(element: Element, afterNode: Node): Node | null {
  let foundAfter = false;
  for (const node of Array.from(element.childNodes)) {
    if (foundAfter && node.nodeType === Node.TEXT_NODE) {
      return node;
    }
    if (node === afterNode) {
      foundAfter = true;
    }
  }
  return null;
}

function findLastTextNode(element: Element): Node | null {
  for (let i = element.childNodes.length - 1; i >= 0; i--) {
    if (element.childNodes[i].nodeType === Node.TEXT_NODE) {
      return element.childNodes[i];
    }
  }
  return null;
}

/**
 * Set selection at a specific DOM position
 */
function setSelectionAtPosition(element: Element, start: { node: Node; offset: number } | null, end: { node: Node; offset: number } | null): void {
  const selection = window.getSelection();
  if (!selection) return;
  
  const range = document.createRange();
  
  if (start) {
    range.setStart(start.node, start.offset);
  } else {
    // Default to beginning
    const firstText = findFirstTextNode(element);
    if (firstText) {
      range.setStart(firstText, 0);
    } else {
      range.selectNodeContents(element);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
  }
  
  if (end) {
    range.setEnd(end.node, end.offset);
  } else {
    range.collapse(false);
  }
  
  selection.removeAllRanges();
  selection.addRange(range);
}

function findFirstTextNode(element: Element): Node | null {
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node;
    }
  }
  return null;
}

function positionPanel(): void {
  if (!panelContainer || !state.currentInput) return;

  const shadow = panelContainer.shadowRoot;
  if (!shadow) return;

  const panel = shadow.getElementById('promptflow-panel') as HTMLElement;
  if (!panel) return;

  // Get panel dimensions
  const panelWidth = 420;
  const panelMinHeight = 200;
  const panelMaxHeight = 500;
  
  // Calculate viewport dimensions
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Fixed position: center horizontally, with percentage padding from top
  const topPaddingPercentage = 0.05; // 5% from top
  const topPadding = viewportHeight * topPaddingPercentage;
  
  // Calculate panel height based on available space below the padding
  const availableHeight = viewportHeight - topPadding - 20; // 20px bottom padding
  const panelHeight = Math.min(Math.max(panelMinHeight, availableHeight), panelMaxHeight);

  // Center horizontally
  const leftPosition = (viewportWidth - panelWidth) / 2;

  // Apply panel dimensions and position
  panel.style.maxHeight = `${panelHeight}px`;
  panelContainer.style.top = `${topPadding}px`;
  panelContainer.style.left = `${leftPosition}px`;
}

const debouncedPositionPanel = debounce(positionPanel, 50);

function openPanel(input: HTMLInputElement | HTMLTextAreaElement | Element, triggerPos: number): void {
  if (state.isPanelOpen) return;
  
  state.isPanelOpen = true;
  state.currentInput = input;
  state.triggerStartPosition = triggerPos;
  state.caretPosition = getCaretPosition(input);
  state.selectedIndex = 0;
  state.searchQuery = '';
  
  panelContainer = createPanel();
  
  // Position panel after it's rendered
  requestAnimationFrame(() => {
    positionPanel();
    
    // Scroll panel into view if needed
    const shadow = panelContainer?.shadowRoot;
    if (shadow) {
      const panel = shadow.getElementById('promptflow-panel') as HTMLElement;
      if (panel) {
        const rect = panel.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  });
  
  // Listen for scroll/resize to reposition
  document.addEventListener('scroll', debouncedPositionPanel, true);
  window.addEventListener('resize', debouncedPositionPanel);
}

function closePanel(restoreFocus: boolean = true, restoreCaretPosition: boolean = true): void {
  // Always try to remove panel container if it exists
  if (panelContainer) {
    panelContainer.remove();
    panelContainer = null;
  }
  
  // Store input and caret position for restoration
  const previousInput = state.currentInput;
  const previousPosition = state.caretPosition;

  // Mark panel as closed
  state.isPanelOpen = false;

  document.removeEventListener('scroll', debouncedPositionPanel, true);
  window.removeEventListener('resize', debouncedPositionPanel);

  // Restore focus to the input and optionally restore cursor position
  if (restoreFocus && previousInput) {
    if (previousInput instanceof HTMLInputElement || previousInput instanceof HTMLTextAreaElement) {
      previousInput.focus();
    } else if (previousInput.hasAttribute('contenteditable')) {
      (previousInput as HTMLElement).focus();
    }
    if (restoreCaretPosition) {
      setCaretPosition(previousInput, previousPosition);
    }
  }
}

/**
 * Clear currentInput state - call this when panel is truly closed
 */
function clearCurrentInput(): void {
  state.currentInput = null;
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!state.isPanelOpen) return;
  
  const shadow = panelContainer?.shadowRoot;
  if (!shadow) return;
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      e.stopPropagation();
      state.selectedIndex = Math.min(state.selectedIndex + 1, state.prompts.length - 1);
      updateSelection(shadow, state.selectedIndex);
      scrollToSelected(shadow);
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      e.stopPropagation();
      state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
      updateSelection(shadow, state.selectedIndex);
      scrollToSelected(shadow);
      break;
      
    case 'Enter':
      e.preventDefault();
      e.stopPropagation();
      if (state.prompts[state.selectedIndex]) {
        selectPrompt(state.prompts[state.selectedIndex]);
      }
      break;
      
    case 'Escape':
      e.preventDefault();
      e.stopPropagation();
      closePanel();
      break;
  }
}

function scrollToSelected(shadow: ShadowRoot): void {
  const list = shadow.getElementById('promptflow-list');
  if (!list) return;
  
  const items = list.querySelectorAll(':scope > div');
  if (items[state.selectedIndex]) {
    items[state.selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function handleInput(e: Event): void {
  const target = e.target as HTMLElement;
  
  if (!target) {
    return;
  }
  
  const isInputElement = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  // Check for contenteditable attribute - can be "", "true", or "contenteditable"
  const isContentEditable = target.isContentEditable || 
    (target.hasAttribute && target.hasAttribute('contenteditable'));
  
  if (!isInputElement && !isContentEditable) {
    return;
  }
  
  const value = getInputValue(target);
  const caretPos = getCaretPosition(target);
  const triggerPos = findTriggerPosition(value, caretPos, state.currentTrigger);
  
  if (triggerPos !== -1 && !state.isPanelOpen) {
    openPanel(target, triggerPos);
  } else if (triggerPos === -1 && state.isPanelOpen) {
    closePanel();
  } else if (state.isPanelOpen) {
    state.caretPosition = caretPos;
  }
}

function handleClick(e: MouseEvent): void {
  if (state.isPanelOpen) {
    const target = e.target as Node;
    if (panelContainer && !panelContainer.contains(target) && !panelContainer.shadowRoot?.contains(target)) {
      closePanel();
    }
  }
}

// Initialize
async function init(): Promise<void> {
  // Load settings from storage first
  await loadSettings();

  // Listen for input events on editable elements
  document.addEventListener('input', handleInput, true);
  
  // Listen for keyboard events
  document.addEventListener('keydown', handleKeyDown, true);
  
  // Listen for clicks to close panel
  document.addEventListener('mousedown', handleClick, true);
  
  // Handle MutationObserver for dynamically added inputs
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          attachListeners(node);
          // Also check for contenteditable in the element itself
          if (node instanceof HTMLElement && node.hasAttribute && (
            node.hasAttribute('contenteditable') || 
            node.getAttribute('contenteditable') !== null
          )) {
            if (!((node as HTMLElement).dataset).promptflowInit) {
              ((node as HTMLElement).dataset).promptflowInit = 'true';
              node.addEventListener('input', handleInput as EventListener, true);
            }
          }
        }
      });
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Attach listeners to existing inputs
  attachListeners(document.body);
}

function attachListeners(root: Element): void {
  // Select all input types, textareas, and contenteditable elements
  // Contenteditable can be: contenteditable="", contenteditable="true", or contenteditable="contenteditable"
  const inputs = root.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), ' +
    'textarea, ' +
    '[contenteditable], ' +
    '[contenteditable="true"], ' +
    '[contenteditable=""]'
  );
  
  inputs.forEach((input) => {
    if (!(input as HTMLElement).dataset.promptflowInit) {
      (input as HTMLElement).dataset.promptflowInit = 'true';
      input.addEventListener('input', handleInput as EventListener, true);
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_PROMPTS') {
    state.prompts = message.prompts;
    if (state.isPanelOpen && panelContainer?.shadowRoot) {
      renderPromptList(panelContainer.shadowRoot, state.prompts);
    }
  }
});
