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

const DEBOUNCE_DELAY = 150;

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

async function loadPrompts(): Promise<Prompt[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['promptflow-data'], (result) => {
      const data = result['promptflow-data'] as { prompts?: Prompt[] } | undefined;
      if (data?.prompts) {
        resolve(data.prompts);
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
  const lastIndex = textBeforeCaret.lastIndexOf(trigger);
  
  if (lastIndex === -1) return -1;
  
  const textAfterTrigger = textBeforeCaret.substring(lastIndex + trigger.length);
  if (textAfterTrigger.includes(' ') || textAfterTrigger.includes('\n')) {
    return -1;
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
  
  // Load React panel
  loadPanelApp(container);
  
  return container;
}

async function loadPanelApp(container: HTMLElement): Promise<void> {
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
    background: #1e1e1e;
    border: 1px solid #3a3a3a;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
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
    border-bottom: 1px solid #3a3a3a;
  `;
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search prompts...';
  searchInput.id = 'promptflow-search';
  searchInput.style.cssText = `
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    background: #2a2a2a;
    color: #ffffff;
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
    border-top: 1px solid #3a3a3a;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: #888;
  `;
  footer.innerHTML = `
    <span>↑↓ Navigate</span>
    <span>Enter to select</span>
    <span>Esc to close</span>
  `;
  panelWrapper.appendChild(footer);
  
  // Load prompts and render
  const prompts = await loadPrompts();
  state.prompts = prompts;
  renderPromptList(shadow, prompts);
  
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
    renderPromptList(shadow, filtered);
  });
}

function renderPromptList(shadow: ShadowRoot, prompts: Prompt[]): void {
  const listContainer = shadow.getElementById('promptflow-list');
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  if (prompts.length === 0) {
    listContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #666;">
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
      background: ${index === state.selectedIndex ? '#3a3a3a' : 'transparent'};
    `;
    
    item.innerHTML = `
      <div style="font-weight: 500; color: #fff; margin-bottom: 4px;">
        ${escapeHtml(prompt.title)}
      </div>
      <div style="font-size: 12px; color: #888; margin-bottom: 6px;">
        ${escapeHtml(prompt.description || '')}
      </div>
      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
        ${prompt.tags.map(tag => `
          <span style="
            padding: 2px 8px;
            background: #2a2a2a;
            border-radius: 4px;
            font-size: 11px;
            color: #6b7280;
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

function updateSelection(shadow: ShadowRoot, index: number): void {
  const items = shadow.querySelectorAll('#promptflow-list > div');
  items.forEach((item, i) => {
    (item as HTMLElement).style.background = i === index ? '#3a3a3a' : 'transparent';
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
    state.currentInput.textContent = newValue;
    
    // Move cursor to end of inserted text
    const newPosition = state.triggerStartPosition + prompt.content.length;
    setCaretPosition(state.currentInput, newPosition);
  }
  
  closePanel();
}

function positionPanel(): void {
  if (!panelContainer || !state.currentInput) return;
  
  const shadow = panelContainer.shadowRoot;
  if (!shadow) return;
  
  const rect = state.currentInput.getBoundingClientRect();
  
  const panel = shadow.getElementById('promptflow-panel') as HTMLElement;
  if (!panel) return;
  
  const panelRect = panel.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  
  let top = rect.bottom + 8;
  let left = rect.left;
  
  // Adjust if panel would go off screen
  if (top + panelRect.height > viewportHeight) {
    top = rect.top - panelRect.height - 8;
  }
  if (left + panelRect.width > viewportWidth) {
    left = viewportWidth - panelRect.width - 16;
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
function init(): void {
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
          if (node.hasAttribute && (
            node.hasAttribute('contenteditable') || 
            node.getAttribute('contenteditable') !== null
          )) {
            if (!node.dataset.promptflowInit) {
              node.dataset.promptflowInit = 'true';
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
