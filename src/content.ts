import { Prompt, DEFAULT_SETTINGS } from './types';

interface ContentState {
  isPanelOpen: boolean;
  currentTrigger: string;
  currentInput: HTMLInputElement | HTMLTextAreaElement | Element | null;
  caretPosition: number;
  triggerStartPosition: number;
  selectedIndex: number;
  prompts: Prompt[];
  searchQuery: string;
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
};

let panelContainer: HTMLElement | null = null;

// Detect system theme preference
function getCurrentTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const DEBOUNCE_DELAY = 150;

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
      const data = result['promptflow-data'] as StorageData | undefined;
      if (data?.prompts) {
        resolve(data.prompts.filter(p => p.enabled !== false));
      } else {
        resolve([]);
      }
    });
  });
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
  
  // Only allow if:
  // 1. Nothing after trigger (cursor is right after trigger)
  // 2. Space/newline after trigger (trigger is a complete word)
  if (textAfterTrigger.length > 0) {
    const nextChar = textAfterTrigger[0];
    // If there's a non-whitespace character after, it's a partial match - don't trigger
    if (!/\s/.test(nextChar)) {
      return -1;
    }
  }

  const remainingText = inputValue.substring(lastIndex);
  const nextSpace = remainingText.indexOf(' ');
  const nextNewline = remainingText.indexOf('\n');
  const endOfTrigger = nextSpace === -1 ? remainingText.length :
                       nextNewline === -1 ? remainingText.length :
                       Math.min(nextSpace, nextNewline);

  return lastIndex;
}


function createPanel(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'promptflow-panel-container';
  container.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  document.body.appendChild(container);
  
  // Load React panel with current theme
  loadPanelApp(container, getCurrentTheme());
  
  return container;
}

async function loadPanelApp(container: HTMLElement, theme?: 'light' | 'dark'): Promise<void> {
  // Use system theme as default, default to light theme
  const isDark = (theme || getCurrentTheme()) === 'dark';

  const colors = isDark ? {
    bg: 'rgba(30, 30, 30, 0.95)',
    border: '#3a3a3a',
    inputBg: 'rgba(42, 42, 42, 0.9)',
    inputBorder: '#3a3a3a',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    hover: '#333333',
    selected: '#262626',
  } : {
    bg: 'rgba(255, 255, 255, 0.98)',
    border: '#e0e0e0',
    inputBg: 'rgba(255, 255, 255, 0.95)',
    inputBorder: '#d0d0d0',
    text: '#1a1a1a',
    textSecondary: '#666666',
    hover: '#f5f5f5',
    selected: '#e8e8e8',
  };
  // Create shadow DOM for style isolation
  const shadow = container.attachShadow({ mode: 'open' });
  
  // Load styles
  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = chrome.runtime.getURL('panel.css');
  shadow.appendChild(linkEl);
  
  // Create panel container
  const panelWrapper = document.createElement('div');
  panelWrapper.id = 'promptflow-panel';
  panelWrapper.style.cssText = `
    background: ${colors.bg};
    border: 1px solid ${colors.border};
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    width: 400px;
    max-height: 500px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;
  shadow.appendChild(panelWrapper);
  
  // Create search input
  const searchContainer = document.createElement('div');
  searchContainer.style.cssText = `
    padding: 12px;
    border-bottom: 1px solid ${colors.border};
  `;
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search prompts...';
  searchInput.id = 'promptflow-search';
  searchInput.style.cssText = `
    width: 100%;
    padding: 10px 14px;
    border: 1px solid ${colors.border};
    border-radius: 8px;
    background: ${isDark ? '#2a2a2a' : '#f0f0f0'};
    color: ${colors.text};
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
  `;
  searchContainer.appendChild(searchInput);
  panelWrapper.appendChild(searchContainer);
  
  // Create prompt list
  const listContainer = document.createElement('div');
  listContainer.id = 'promptflow-list';
  listContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  `;
  panelWrapper.appendChild(listContainer);
  
  // Create footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 10px 12px;
    border-top: 1px solid ${'rgba(255, 255, 255, 0.08)'};
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: ${colors.textSecondary};
  `;
  footer.innerHTML = `
    <div style="display: flex; gap: 16px;">
      <span class="footer-hint"><span class="footer-key">↑↓</span> Navigate</span>
      <span class="footer-hint"><span class="footer-key">Enter</span> Select</span>
      <span class="footer-hint"><span class="footer-key">Esc</span> Close</span>
    </div>
    <button id="promptflow-settings-btn" style="
      background: none;
      border: none;
      color: ${colors.textSecondary};
      cursor: pointer;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    ">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.6;">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
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
      // Open settings page
      if (chrome.action && chrome.action.openPopup) {
        chrome.action.openPopup();
      } else {
        // Fallback: open settings in new tab
        window.open(chrome.runtime.getURL('settings.html'), '_blank');
      }
    });
    
    // Add hover effect
    settingsBtn.addEventListener('mouseenter', () => {
      settingsBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      settingsBtn.style.color = 'rgba(255, 255, 255, 0.7)';
    });
    settingsBtn.addEventListener('mouseleave', () => {
      settingsBtn.style.backgroundColor = 'transparent';
      settingsBtn.style.color = 'rgba(255, 255, 255, 0.4)';
    });
  }
  
  // Load prompts and render
  const prompts = await loadPrompts();
  state.prompts = prompts;
  renderPromptList(shadow, prompts, getCurrentTheme());
  
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
    renderPromptList(shadow, filtered, getCurrentTheme());
  });
}

function renderPromptList(shadow: ShadowRoot, prompts: Prompt[], theme?: 'light' | 'dark'): void {
  const isDark = theme !== 'light';
  const listContainer = shadow.getElementById('promptflow-list');
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  if (prompts.length === 0) {
    listContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: ${isDark ? '#666' : '#999'};">
        No prompts found
      </div>
    `;
    return;
  }
  
  prompts.forEach((prompt, index) => {
    const item = document.createElement('div');
    item.className = index === state.selectedIndex ? 'selected' : '';
    item.style.cssText = `
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 4px;
      transition: background 0.15s;
      background: ${index === state.selectedIndex ? (isDark ? '#3a3a3a' : '#e8e8e8') : 'transparent'};
    `;
    
    item.innerHTML = `
      <div style="font-weight: 500; color: ${isDark ? '#fff' : '#1a1a1a'}; margin-bottom: 4px;">
        ${escapeHtml(prompt.title)}
      </div>
      <div style="font-size: 12px; color: ${isDark ? '#888' : '#666'}; margin-bottom: 6px;">
        ${escapeHtml(prompt.description || '')}
      </div>
      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
        ${prompt.tags.map(tag => `
          <span style="
            padding: 2px 8px;
            background: ${isDark ? '#2a2a2a' : '#f0f0f0'};
            border-radius: 4px;
            font-size: 11px;
            color: ${isDark ? '#6b7280' : '#888'};
          ">${escapeHtml(tag)}</span>
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

function updateSelection(shadow: ShadowRoot, index: number, theme?: 'light' | 'dark'): void {
  const isDark = theme !== 'light';
  const items = shadow.querySelectorAll('#promptflow-list > div');
  items.forEach((item, i) => {
    (item as HTMLElement).style.background = i === index ? (isDark ? '#3a3a3a' : '#e8e8e8') : 'transparent';
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function selectPrompt(prompt: Prompt): void {
  if (!state.currentInput) return;
  
  const inputValue = getInputValue(state.currentInput);
  
  // Replace trigger with prompt content
  const before = inputValue.substring(0, state.triggerStartPosition);
  const after = inputValue.substring(state.caretPosition);
  const newValue = before + prompt.content + after;
  
  if (state.currentInput instanceof HTMLInputElement || state.currentInput instanceof HTMLTextAreaElement) {
    state.currentInput.value = newValue;
    state.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Move cursor to end of inserted text
    const newPosition = state.triggerStartPosition + prompt.content.length;
    setCaretPosition(state.currentInput, newPosition);
  } else if (state.currentInput.hasAttribute('contenteditable')) {
    // For contenteditable elements, we need to properly handle newlines
    // by inserting <br> tags instead of just setting textContent
    insertContentWithNewlines(state.currentInput, newValue, state.triggerStartPosition, prompt.content.length);
  }
  
  closePanel();
}

/**
 * Insert content into contenteditable element, properly handling newlines
 */
function insertContentWithNewlines(element: Element, newValue: string, startPos: number, contentLength: number): void {
  // Clear the element
  element.textContent = '';
  
  // Insert the new content with proper newline handling
  const lines = newValue.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      // Insert <br> for newlines between lines
      element.appendChild(document.createElement('br'));
    }
    
    if (lines[i].length > 0) {
      element.appendChild(document.createTextNode(lines[i]));
    }
  }
  
  // Move cursor to end of inserted text
  setCaretPosition(element, startPos + contentLength);
}

function positionPanel(): void {
  if (!panelContainer || !state.currentInput) return;
  
  const shadow = panelContainer.shadowRoot;
  if (!shadow) return;
  
  const rect = state.currentInput.getBoundingClientRect();
  
  const panel = shadow.getElementById('promptflow-panel') as HTMLElement;
  if (!panel) return;
  
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const panelWidth = 400; // Panel width from CSS
  const panelMaxHeight = 500; // Panel max-height from CSS
  const padding = 8; // Minimum distance from viewport edges
  
  // Calculate initial position (below the input)
  let top = rect.bottom + padding;
  let left = rect.left;
  
  // Check if there's enough space below the input
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  
  // Choose vertical position: below or above input
  if (spaceBelow >= panelMaxHeight + padding * 2) {
    // Plenty of space below, use bottom position
    top = rect.bottom + padding;
  } else if (spaceAbove >= panelMaxHeight + padding * 2) {
    // Not enough space below, but enough above
    top = rect.top - panelMaxHeight - padding;
  } else if (spaceBelow >= spaceAbove) {
    // Use bottom but limit height
    top = rect.bottom + padding;
  } else {
    // Use top but limit height
    top = padding;
  }
  
  // Horizontal positioning: try to align with input, adjust if needed
  // First, try to position to the right of the input
  let preferredLeft = rect.left;
  
  // Check if panel fits to the right of input
  if (preferredLeft + panelWidth > viewportWidth - padding) {
    // Try to position to the left of input
    preferredLeft = rect.right - panelWidth;
    
    // If still doesn't fit, center horizontally
    if (preferredLeft < padding) {
      preferredLeft = (viewportWidth - panelWidth) / 2;
    }
  }
  
  // Ensure left edge doesn't go off screen
  if (preferredLeft < padding) {
    left = padding;
  } else if (preferredLeft + panelWidth > viewportWidth - padding) {
    left = viewportWidth - panelWidth - padding;
  } else {
    left = preferredLeft;
  }
  
  // Final safety check: ensure panel stays within viewport
  // Clamp top to stay within viewport
  if (top < padding) {
    top = padding;
  }
  if (top + panelMaxHeight > viewportHeight - padding) {
    top = Math.max(padding, viewportHeight - panelMaxHeight - padding);
  }
  
  panelContainer.style.top = `${top}px`;
  panelContainer.style.left = `${left}px`;
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

function closePanel(): void {
  if (!state.isPanelOpen) return;
  
  state.isPanelOpen = false;
  state.currentInput = null;
  
  document.removeEventListener('scroll', debouncedPositionPanel, true);
  window.removeEventListener('resize', debouncedPositionPanel);
  
  if (panelContainer) {
    panelContainer.remove();
    panelContainer = null;
  }
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
      renderPromptList(panelContainer.shadowRoot, state.prompts, getCurrentTheme());
    }
  }
});
