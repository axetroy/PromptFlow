import { Prompt, DEFAULT_SETTINGS, DEFAULT_PROMPTS, PromptUsage, PromptSettings } from './types';
import { SyncedRepo, SyncedPrompt } from './types/sync';
import { showVariableInput, hideVariableInput, hasVariables } from './components/modals/VariableInputModal';
import { showPromptPanel, hidePromptPanel } from './components/PromptPanel';
import { getInputValue, getCaretPosition, setCaretPosition, insertContentWithNewlines } from './utils/dom';

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
  recentPromptIds: string[]; // Recently used prompt IDs
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
  recentPromptIds: [],
};

const MAX_RECENT_PROMPTS = 5;

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

async function loadUsageHistory(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['promptflow-data'], (result) => {
      const data = result['promptflow-data'] as { usageHistory?: PromptUsage[] } | undefined;
      if (data?.usageHistory) {
        // Extract unique prompt IDs from usage history (most recent first)
        const seen = new Set<string>();
        const recentIds: string[] = [];
        for (const usage of data.usageHistory) {
          if (!seen.has(usage.promptId)) {
            seen.add(usage.promptId);
            recentIds.push(usage.promptId);
            if (recentIds.length >= MAX_RECENT_PROMPTS) break;
          }
        }
        state.recentPromptIds = recentIds;
      }
      resolve();
    });
  });
}

async function recordPromptUsage(promptId: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['promptflow-data'], (result) => {
      const data = (result['promptflow-data'] as { usageHistory?: PromptUsage[] } | undefined) || {};
      const history: PromptUsage[] = data.usageHistory || [];
      
      // Add new usage at the beginning (no deduplication - we want to track total usage count)
      history.unshift({ promptId, usedAt: Date.now() });
      
      // Trim to max size (100 entries)
      const trimmed = history.slice(0, 100);
      
      chrome.storage.local.set({
        'promptflow-data': {
          ...data,
          usageHistory: trimmed,
        },
      }, () => {
        // Update local state for "recent prompts" (unique prompts only)
        const seen = new Set<string>();
        const recentIds: string[] = [];
        for (const usage of trimmed) {
          if (!seen.has(usage.promptId)) {
            seen.add(usage.promptId);
            recentIds.push(usage.promptId);
            if (recentIds.length >= MAX_RECENT_PROMPTS) break;
          }
        }
        state.recentPromptIds = recentIds;
        resolve();
      });
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
        settings?: PromptSettings;
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
      /[([{]/.test(textBeforeCaret[found - 1]);
    
    if (isWordBoundary) {
      lastIndex = found;
    }
    
    searchStart = found + 1;
  }
  
  if (lastIndex === -1) return -1;

  // Check that the trigger is complete (no partial matches like /pa for /p)
  const textAfterTrigger = textBeforeCaret.substring(lastIndex + trigger.length);
  
  // The cursor must be at or after the trigger end
  // Whitespace after the trigger is OK (e.g., "/prompts " with cursor at 9 is valid)
  // Examples:
  // - "/prompts" with cursor at 8 → MATCH (cursor right after trigger)
  // - "/prompts " with cursor at 9 → MATCH (whitespace after trigger is OK)
  // - "/prompts world" with cursor at 15 → MATCH (whitespace between trigger and cursor is OK)
  // - "/promptsX" with cursor at 9 → NO MATCH ('X' directly after trigger)
  
  // If there's content between trigger end and cursor, check if it's all whitespace
  if (textAfterTrigger.length > 0) {
    // Only whitespace between trigger and cursor (or cursor is right at end) is valid
    if (textAfterTrigger.trim().length > 0) {
      // Non-whitespace content directly after trigger - partial match
      return -1;
    }
    // Only whitespace after trigger - this is valid
  }
  
  // Valid match
  return lastIndex;
}


/**
 * Create and show the React PromptPanel
 * This replaces the old createPanel/loadPanelApp functions
 */
async function createPanel(): Promise<void> {
  // Load prompts first
  const prompts = await loadPrompts();
  state.prompts = prompts;
  state.searchQuery = '';
  
  // Show the React PromptPanel
  showPromptPanel({
    prompts: state.prompts,
    recentPromptIds: state.recentPromptIds,
    searchQuery: state.searchQuery,
    onSearchChange: (query: string) => {
      state.searchQuery = query;
    },
    onPromptSelect: (prompt: Prompt) => {
      selectPrompt(prompt);
    },
    onClose: () => {
      closePanel();
    },
    onOpenSettings: () => {
      closePanel();
      // Send message to background script to open settings
      chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' }).catch(() => {
        // Fallback: open settings in new tab
        window.open(chrome.runtime.getURL('settings.html'), '_blank');
      });
    },
  });
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
  // - before: text before trigger
  // - after: text after trigger (not after caret)
  const triggerEndPosition = state.triggerStartPosition + state.currentTrigger.length;
  const before = inputValue.substring(0, state.triggerStartPosition);
  const after = inputValue.substring(triggerEndPosition);
  const newValue = before + promptContent + after;
  
  // Position cursor at end of inserted prompt content (including language instruction)
  // Cursor should be at: triggerStart + promptContent.length
  const cursorPosition = state.triggerStartPosition + promptContent.length;
  
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
    // Focus first
    textarea.focus();
    // Set cursor position immediately after focus
    textarea.setSelectionRange(cursorPosition, cursorPosition);
    // Dispatch input event so frameworks can detect the change
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  
  if (targetInput instanceof HTMLInputElement) {
    // Use native setter to bypass any framework overrides
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    nativeSetter.call(targetInput, newValue);
    targetInput.focus();
    targetInput.setSelectionRange(cursorPosition, cursorPosition);
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (targetInput.hasAttribute && targetInput.hasAttribute('contenteditable')) {
    // For contenteditable, insert at position (pass cursorPosition directly)
    insertContentWithNewlines(targetInput, promptContent, state.triggerStartPosition, state.currentTrigger.length);
  }
}

/**
 * Select a prompt - checks for variables and shows input modal if needed
 */
async function selectPrompt(prompt: Prompt): Promise<void> {
  // Record prompt usage immediately (before any early returns)
  await recordPromptUsage(prompt.id);
  
  if (!state.currentInput) return;
  
  // Check if the prompt has template variables
  if (hasVariables(prompt.content)) {
    // Store the prompt
    state.pendingPrompt = prompt;
    
    // Store the input reference and positions for later use when inserting
    const targetInput = state.currentInput;
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
        // Hide the modal first
        hideVariableInput();
        
        if (state.pendingPrompt) {
          // Restore the state values using stored references
          state.currentInput = targetInput;
          state.triggerStartPosition = triggerStart;
          state.caretPosition = caretPos;
          insertPromptWithContent(state.pendingPrompt, filledContent);
          state.pendingPrompt = null;
        }
      },
      onCancel: () => {
        // Hide the modal
        hideVariableInput();
        
        // Restore focus to original input
        if (targetInput) {
          if (targetInput instanceof HTMLInputElement || targetInput instanceof HTMLTextAreaElement) {
            targetInput.focus();
            setCaretPosition(targetInput, caretPos);
          } else if (targetInput.hasAttribute && targetInput.hasAttribute('contenteditable')) {
            (targetInput as HTMLElement).focus();
            setCaretPosition(targetInput, caretPos);
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
 * This function:
 * 1. Gets current text content from element
 * 2. Replaces trigger with content (preserving context before and after)
 * 3. Clears element and re-inserts with proper <br> handling
 * 4. Sets cursor position at the end of inserted content
 */
/**
 * Open the prompt panel at the current input position
 */
async function openPanel(input: HTMLInputElement | HTMLTextAreaElement | Element, triggerPos: number): Promise<void> {
  if (state.isPanelOpen) return;
  
  state.isPanelOpen = true;
  state.currentInput = input;
  state.triggerStartPosition = triggerPos;
  state.caretPosition = getCaretPosition(input);
  state.selectedIndex = 0;
  state.searchQuery = '';
  
  // Create and show the React panel
  await createPanel();
}

/**
 * Close the prompt panel
 */
function closePanel(restoreFocus: boolean = true, restoreCaretPosition: boolean = true): void {
  // Hide the React panel
  hidePromptPanel();
  
  // Store input and caret position for restoration
  const previousInput = state.currentInput;
  const previousPosition = state.caretPosition;

  // Mark panel as closed
  state.isPanelOpen = false;
  
  // Clear the host element reference
  const hostElement = document.getElementById('promptflow-panel-host');
  if (hostElement) {
    hostElement.remove();
  }

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
 * Global keyboard handler - handles all keyboard events for both PromptPanel and VariableInputModal
 */
function handleKeyDown(e: KeyboardEvent): void {
  // Handle Escape for VariableInputModal
  if (e.key === 'Escape' && state.pendingPrompt) {
    e.preventDefault();
    e.stopPropagation();
    
    const targetInput = state.currentInput;
    const caretPos = state.caretPosition;
    hideVariableInput();
    
    if (targetInput) {
      if (targetInput instanceof HTMLInputElement || targetInput instanceof HTMLTextAreaElement) {
        targetInput.focus();
        setCaretPosition(targetInput, caretPos);
      } else if (targetInput.hasAttribute && targetInput.hasAttribute('contenteditable')) {
        (targetInput as HTMLElement).focus();
        setCaretPosition(targetInput, caretPos);
      }
    }
    state.pendingPrompt = null;
    return;
  }
  
  // Handle Escape for PromptPanel
  if (e.key === 'Escape' && state.isPanelOpen) {
    e.preventDefault();
    e.stopPropagation();
    closePanel();
    return;
  }
}

// Handle input events on editable elements
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

// Handle click events - close panel when clicking outside
function handleClick(e: MouseEvent): void {
  const target = e.target as Node;
  
  // Check if clicking outside the panel (for PromptPanel)
  if (state.isPanelOpen) {
    const panelHost = document.getElementById('promptflow-panel-host');
    if (panelHost && !panelHost.contains(target) && !panelHost.shadowRoot?.contains(target)) {
      closePanel();
    }
  }
  
  // Check if clicking outside the variable input modal
  if (state.pendingPrompt) {
    const modalHost = document.getElementById('promptflow-variable-input-host');
    if (modalHost && !modalHost.contains(target) && !modalHost.shadowRoot?.contains(target)) {
      // Don't auto-close modal on outside click - let the modal handle it
      // This is different from the panel behavior
    }
  }
}

// Initialize
async function init(): Promise<void> {
  // Load settings from storage first
  await loadSettings();

  // Load usage history
  await loadUsageHistory();

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
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_PROMPTS') {
    state.prompts = message.prompts;
    // If panel is open, close it - user will need to re-open to see new prompts
    if (state.isPanelOpen) {
      closePanel();
    }
  }
});
