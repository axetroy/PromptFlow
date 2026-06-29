/**
 * VariableInput - Pure DOM Implementation for Chrome Extension Content Script
 * 
 * This module provides a variable input modal for filling in template variables
 * before inserting prompts into input fields.
 * 
 * Supports syntax:
 * - <VAR name="variable_name"></VAR> - Required variable
 * - <VAR name="variable_name" defaultValue="default_value"></VAR> - Variable with default value
 * - <VAR name="variable_name" description="Description text"></VAR> - Variable with description
 * 
 * Features:
 * - CSS classes instead of inline styles
 * - Dark mode support via CSS custom properties
 * - Responsive and accessible
 */

import { getUniqueVariables, interpolate, Variable } from './utils/template-parser';

export interface VariableInputOptions {
  prompt: {
    id: string;
    title: string;
    content: string;
  };
  onConfirm: (filledContent: string) => void;
  onCancel: () => void;
}

// Store for active modal instance
let activeModal: HTMLElement | null = null;
let activeValues: Record<string, string> = {};
let activeVariables: Variable[] = [];
let activePromptContent: string = '';
let activeOnConfirm: ((content: string) => void) | null = null;
let activeOnCancel: (() => void) | null = null;
let activeInputRefs: HTMLElement[] = [];

// CSS styles for the modal with light/dark mode support
const MODAL_CSS = `
  .vf-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--vf-overlay-bg, rgba(0, 0, 0, 0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: vf-fade-in 0.2s ease-out;
  }

  @keyframes vf-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .vf-modal-content {
    background-color: var(--vf-content-bg, #fff);
    border-radius: 12px;
    box-shadow: var(--vf-content-shadow, 0 20px 60px rgba(0, 0, 0, 0.3));
    width: 90%;
    max-width: 660px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: vf-slide-up 0.2s ease-out;
  }

  @keyframes vf-slide-up {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .vf-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--vf-border-color, #e8e8e8);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }

  .vf-header-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .vf-header-subtitle {
    font-size: 13px;
    opacity: 0.9;
  }

  .vf-body {
    flex: 1;
    overflow: auto;
    background-color: var(--vf-body-bg, #fff);
  }

  .vf-body-inner {
    padding: 24px;
  }

  .vf-section-title {
    display: block;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 12px;
    color: var(--vf-text-primary, #333);
  }

  .vf-empty-state {
    text-align: center;
    padding: 20px;
    color: var(--vf-text-muted, #999);
    background: var(--vf-empty-bg, #fafafa);
    border-radius: 8px;
    margin-bottom: 24px;
  }

  .vf-variable-item {
    margin-bottom: 20px;
    padding: 16px;
    background: var(--vf-item-bg, #fafafa);
    border-radius: 8px;
    border: 1px solid var(--vf-item-border, #f0f0f0);
  }

  .vf-variable-name {
    font-family: 'SF Mono', Monaco, monospace;
    background: var(--vf-name-bg, #262626);
    color: var(--vf-name-color, #fff);
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    display: inline-block;
  }

  .vf-variable-description {
    font-size: 13px;
    color: var(--vf-text-muted, #999);
    margin-top: 8px;
    margin-bottom: 8px;
    line-height: 1.4;
  }

  .vf-badges {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .vf-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .vf-badge-default {
    background: var(--vf-badge-default-bg, #f6ffed);
    color: var(--vf-badge-default-color, #52c41a);
  }

  .vf-badge-required {
    background: var(--vf-badge-required-bg, #fff2e8);
    color: var(--vf-badge-required-color, #fa8c16);
  }

  .vf-variable-input {
    width: 100%;
    padding: 12px 14px;
    font-size: 14px;
    border: 1px solid var(--vf-input-border, #d9d9d9);
    border-radius: 6px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;
    resize: vertical;
    min-height: 72px;
    font-family: inherit;
    line-height: 1.5;
    background: var(--vf-input-bg, #fff);
    color: var(--vf-text-primary, #333);
  }

  .vf-variable-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  }

  .vf-preview {
    background-color: var(--vf-preview-bg, #f8f8f8);
    border: 1px solid var(--vf-preview-border, #e8e8e8);
    border-radius: 8px;
    padding: 16px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--vf-text-primary, #333);
    max-height: 250px;
    overflow: auto;
    white-space: pre;
    word-break: break-word;
    font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
  }

  .vf-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--vf-border-color, #e8e8e8);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--vf-footer-bg, #fafafa);
  }

  .vf-footer-hint {
    font-size: 12px;
    color: var(--vf-text-muted, #999);
  }

  .vf-footer-hint kbd {
    background: var(--vf-kbd-bg, #fff);
    border: 1px solid var(--vf-kbd-border, #d9d9d9);
    border-radius: 4px;
    padding: 2px 6px;
    font-family: monospace;
  }

  .vf-footer-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
  }

  .vf-tooltip {
    position: absolute;
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    background: #333;
    color: #fff;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    margin-right: 8px;
  }

  .vf-tooltip kbd {
    background: #555;
    border-radius: 3px;
    padding: 1px 5px;
    margin: 0 2px;
  }

  .vf-cancel-btn {
    padding: 8px 20px;
    font-size: 14px;
    border: 1px solid var(--vf-btn-cancel-border, #d9d9d9);
    border-radius: 6px;
    background: var(--vf-btn-cancel-bg, #fff);
    cursor: pointer;
    color: var(--vf-text-primary, #333);
    transition: background-color 0.2s;
  }

  .vf-cancel-btn:hover {
    background: var(--vf-btn-cancel-hover, #f5f5f5);
  }

  .vf-submit-btn {
    padding: 8px 20px;
    font-size: 14px;
    border: none;
    border-radius: 6px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
  }

  .vf-submit-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .vf-submit-btn:disabled {
    background: var(--vf-btn-disabled-bg, #d9d9d9);
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Dark mode styles */
  @media (prefers-color-scheme: dark) {
    :root {
      --vf-overlay-bg: rgba(0, 0, 0, 0.7);
      --vf-content-bg: #1f1f1f;
      --vf-content-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      --vf-border-color: #404040;
      --vf-body-bg: #1f1f1f;
      --vf-text-primary: #e5e5e5;
      --vf-text-muted: #8c8c8c;
      --vf-item-bg: #262626;
      --vf-item-border: #404040;
      --vf-name-bg: #404040;
      --vf-empty-bg: #262626;
      --vf-badge-default-bg: rgba(82, 196, 26, 0.2);
      --vf-badge-default-color: #73d13d;
      --vf-badge-required-bg: rgba(250, 140, 22, 0.2);
      --vf-badge-required-color: #fa8c16;
      --vf-input-border: #404040;
      --vf-input-bg: #262626;
      --vf-preview-bg: #262626;
      --vf-preview-border: #404040;
      --vf-footer-bg: #262626;
      --vf-kbd-bg: #404040;
      --vf-kbd-border: #595959;
      --vf-btn-cancel-border: #404040;
      --vf-btn-cancel-bg: #262626;
      --vf-btn-cancel-hover: #333;
      --vf-btn-disabled-bg: #404040;
    }
  }
`;

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Inject CSS styles into document head
 */
function injectStyles(): void {
  if (document.getElementById('vf-styles')) return;
  const style = document.createElement('style');
  style.id = 'vf-styles';
  style.textContent = MODAL_CSS;
  document.head.appendChild(style);
}

/**
 * Update the preview display
 */
function updatePreview(): void {
  if (!activeModal) return;
  
  const previewEl = activeModal.querySelector('.vf-preview') as HTMLElement;
  if (previewEl) {
    previewEl.textContent = interpolate(activePromptContent, activeValues);
  }
}

/**
 * Check if all required variables are filled
 */
function canSubmit(): boolean {
  return activeVariables.every(v => 
    v.defaultValue !== undefined || (activeValues[v.name] && activeValues[v.name].trim() !== '')
  );
}

/**
 * Update submit button state
 */
function updateSubmitButton(): void {
  if (!activeModal) return;
  
  const submitBtn = activeModal.querySelector('.vf-submit-btn') as HTMLButtonElement;
  if (submitBtn) {
    const enabled = canSubmit();
    submitBtn.disabled = !enabled;
  }
}

/**
 * Focus next input or submit button
 */
function focusNext(currentIndex: number): void {
  if (currentIndex < activeInputRefs.length - 1) {
    const nextInput = activeInputRefs[currentIndex + 1];
    nextInput.focus();
    
    if (nextInput instanceof HTMLTextAreaElement) {
      const len = nextInput.value.length;
      nextInput.setSelectionRange(len, len);
    }
  } else {
    const submitBtn = activeModal?.querySelector('.vf-submit-btn') as HTMLButtonElement;
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.focus();
    }
  }
}

/**
 * Create and show the variable input modal
 */
export function showVariableInput(options: VariableInputOptions): void {
  const { prompt, onConfirm, onCancel } = options;
  
  hideVariableInput();
  
  activeVariables = getUniqueVariables(prompt.content);
  activePromptContent = prompt.content;
  activeOnConfirm = onConfirm;
  activeOnCancel = onCancel;
  activeInputRefs = [];
  
  activeValues = {};
  activeVariables.forEach(v => {
    activeValues[v.name] = v.defaultValue || '';
  });
  
  injectStyles();
  
  const modal = document.createElement('div');
  modal.className = 'vf-modal-overlay';
  
  const content = document.createElement('div');
  content.className = 'vf-modal-content';
  
  // Build variable inputs HTML
  const variableInputsHtml = activeVariables.map((variable, index) => {
    const descriptionHtml = variable.description 
      ? `<div class="vf-variable-description">${escapeHtml(variable.description)}</div>`
      : '';
    
    const badges = [];
    if (variable.defaultValue !== undefined) {
      badges.push(`<span class="vf-badge vf-badge-default">Default: ${escapeHtml(variable.defaultValue)}</span>`);
    } else {
      badges.push(`<span class="vf-badge vf-badge-required">Required</span>`);
    }
    
    const badgesHtml = `<div class="vf-badges">${badges.join('')}</div>`;
    
    return `
      <div class="vf-variable-item">
        <span class="vf-variable-name">\${${escapeHtml(variable.name)}}</span>
        ${descriptionHtml}
        ${badgesHtml}
        <textarea 
          class="vf-variable-input" 
          data-variable="${escapeHtml(variable.name)}"
          data-index="${index}"
          placeholder="${variable.defaultValue ? escapeHtml(variable.defaultValue) : 'Enter value...'}"
          rows="3"
        >${escapeHtml(activeValues[variable.name])}</textarea>
      </div>
    `;
  }).join('');
  
  content.innerHTML = `
    <div class="vf-header">
      <div class="vf-header-title">💬 Fill Variables</div>
      <div class="vf-header-subtitle">${escapeHtml(prompt.title)}</div>
    </div>
    <div class="vf-body">
      <div class="vf-body-inner">
        ${activeVariables.length > 0 ? `
          <label class="vf-section-title">📋 Variable Values</label>
          ${variableInputsHtml}
        ` : `
          <div class="vf-empty-state">This template does not contain any variables</div>
        `}
        <label class="vf-section-title">👁️ Preview</label>
        <div class="vf-preview"></div>
      </div>
    </div>
    <div class="vf-footer">
      <div class="vf-footer-hint">
        Press <kbd>Esc</kbd> to cancel
      </div>
      <div class="vf-footer-actions">
        <div class="vf-tooltip">
          Press <kbd>Enter</kbd> to insert
        </div>
        <button type="button" class="vf-cancel-btn">Cancel</button>
        <button type="button" class="vf-submit-btn">✨ Insert Prompt</button>
      </div>
    </div>
  `;
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  activeModal = modal;
  
  // Event handlers
  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === modal) {
      handleCancel();
    }
  };
  
  const handleCancel = () => {
    if (activeOnCancel) {
      activeOnCancel();
    }
    hideVariableInput();
  };
  
  const handleSubmit = () => {
    const filledContent = interpolate(activePromptContent, activeValues);
    if (activeOnConfirm) {
      activeOnConfirm(filledContent);
    }
    hideVariableInput();
  };
  
  const handleInputChange = (e: Event) => {
    const input = e.target as HTMLTextAreaElement;
    const variableName = input.dataset.variable;
    if (variableName) {
      activeValues[variableName] = input.value;
      updatePreview();
      updateSubmitButton();
    }
  };
  
  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
      if (target.classList.contains('vf-variable-input')) {
        e.preventDefault();
        const currentIndex = parseInt(target.dataset.index || '0', 10);
        focusNext(currentIndex);
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || target.classList.contains('vf-submit-btn'))) {
      if (canSubmit()) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };
  
  modal.addEventListener('click', handleOverlayClick);
  
  const cancelBtn = content.querySelector('.vf-cancel-btn');
  cancelBtn?.addEventListener('click', handleCancel);
  
  const submitBtn = content.querySelector('.vf-submit-btn') as HTMLButtonElement;
  const tooltip = content.querySelector('.vf-tooltip') as HTMLElement;
  
  submitBtn?.addEventListener('click', handleSubmit);
  
  submitBtn?.addEventListener('focus', () => {
    if (tooltip) tooltip.style.opacity = '1';
  });
  
  submitBtn?.addEventListener('blur', () => {
    if (tooltip) tooltip.style.opacity = '0';
  });
  
  const variableInputs = content.querySelectorAll('.vf-variable-input');
  variableInputs.forEach((input) => {
    activeInputRefs.push(input as HTMLElement);
    input.addEventListener('input', handleInputChange);
    input.addEventListener('keydown', handleKeyDown);
  });
  
  document.addEventListener('keydown', handleKeyDown);
  
  (modal as any)._cleanupHandlers = { handleKeyDown };
  
  updatePreview();
  
  const firstInput = content.querySelector('.vf-variable-input') as HTMLTextAreaElement;
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }
  
  updateSubmitButton();
}

/**
 * Hide and remove the variable input modal
 */
export function hideVariableInput(): void {
  if (activeModal) {
    const cleanupHandlers = (activeModal as any)._cleanupHandlers;
    if (cleanupHandlers?.handleKeyDown) {
      document.removeEventListener('keydown', cleanupHandlers.handleKeyDown);
    }
    
    activeModal.remove();
    activeModal = null;
  }
  activeValues = {};
  activeVariables = [];
  activePromptContent = '';
  activeOnConfirm = null;
  activeOnCancel = null;
  activeInputRefs = [];
}

// Re-export template parser utilities for external use
export { getUniqueVariables, interpolate, hasVariables } from './utils/template-parser';