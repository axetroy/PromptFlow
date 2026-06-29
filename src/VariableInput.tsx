/**
 * VariableInput - Pure DOM Implementation for Chrome Extension Content Script
 * 
 * This module provides a variable input modal for filling in template variables
 * before inserting prompts into input fields.
 * 
 * Supports syntax:
 * - {variable_name} - Required variable
 * - {variable_name:default_value} - Variable with default value
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
let activeInputRefs: HTMLElement[] = []; // Store all input elements for navigation

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Update the preview display - preserves template formatting without indentation
 */
function updatePreview(): void {
  if (!activeModal) return;
  
  const previewEl = activeModal.querySelector('.vf-preview') as HTMLElement;
  if (previewEl) {
    // Use textContent to avoid XSS and preserve exact formatting
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
    submitBtn.style.background = enabled 
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
      : '#d9d9d9';
    submitBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    submitBtn.style.opacity = enabled ? '1' : '0.6';
  }
}

/**
 * Focus next input or submit button
 */
function focusNext(currentIndex: number): void {
  if (currentIndex < activeInputRefs.length - 1) {
    // Focus next input
    activeInputRefs[currentIndex + 1].focus();
  } else {
    // Last input - focus submit button
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
  
  // Close any existing modal
  hideVariableInput();
  
  // Initialize state
  activeVariables = getUniqueVariables(prompt.content);
  activePromptContent = prompt.content;
  activeOnConfirm = onConfirm;
  activeOnCancel = onCancel;
  activeInputRefs = [];
  
  // Initialize values with defaults
  activeValues = {};
  activeVariables.forEach(v => {
    activeValues[v.name] = v.defaultValue || '';
  });
  
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'vf-modal-overlay';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  
  // Create modal content
  const content = document.createElement('div');
  content.className = 'vf-modal-content';
  content.style.cssText = `
    background-color: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 90%;
    max-width: 660px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;
  
  // Build variable inputs HTML - using textarea for multiline support
  const variableInputsHtml = activeVariables.map((variable, index) => `
    <div class="vf-variable-item" style="margin-bottom: 16px;">
      <label class="vf-variable-label" style="display: flex; align-items: center; font-size: 13px; margin-bottom: 6px; color: #666;">
        <span style="font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 4px;">
          {${escapeHtml(variable.name)}${variable.defaultValue !== undefined ? ':' + escapeHtml(variable.defaultValue) : ''}}
        </span>
        ${variable.defaultValue !== undefined 
          ? `<span style="margin-left: 8px; font-size: 11px; color: #999;">(default: ${escapeHtml(variable.defaultValue)})</span>`
          : `<span style="margin-left: 8px; font-size: 11px; color: #f5222d;">* required</span>`
        }
      </label>
      <textarea 
        class="vf-variable-input" 
        data-variable="${escapeHtml(variable.name)}"
        data-index="${index}"
        placeholder="${variable.defaultValue ? escapeHtml(variable.defaultValue) : `Enter ${escapeHtml(variable.name)}...`}"
        rows="3"
        style="width: 100%; padding: 10px 12px; font-size: 14px; border: 1px solid #d9d9d9; border-radius: 6px; outline: none; box-sizing: border-box; transition: border-color 0.2s; resize: vertical; min-height: 60px; font-family: inherit; line-height: 1.5;"
      >${escapeHtml(activeValues[variable.name])}</textarea>
    </div>
  `).join('');
  
  // Build HTML
  content.innerHTML = `
    <div class="vf-header" style="padding: 20px 24px; border-bottom: 1px solid #e8e8e8; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff;">
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">Fill in Variables</div>
      <div style="font-size: 13px; opacity: 0.9;">${escapeHtml(prompt.title)}</div>
    </div>
    <div class="vf-body" style="flex: 1; overflow: auto;">
      <div style="padding: 24px;">
        ${activeVariables.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 12px; color: #333;">Variable Values</label>
            ${variableInputsHtml}
          </div>
        ` : `
          <div style="text-align: center; padding: 20px; color: #999; background: #fafafa; border-radius: 8px; margin-bottom: 24px;">
            No variables in this template
          </div>
        `}
        <div>
          <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 12px; color: #333;">Preview</label>
          <div class="vf-preview" style="background-color: #f8f8f8; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #333; max-height: 250px; overflow: auto; white-space: pre; word-break: break-word; font-family: "SF Mono", Monaco, "Cascadia Code", monospace;"></div>
        </div>
      </div>
    </div>
    <div class="vf-footer" style="padding: 16px 24px; border-top: 1px solid #e8e8e8; display: flex; justify-content: space-between; align-items: center; background: #fafafa;">
      <div style="font-size: 12px; color: #999;">
        Press <kbd style="background: #fff; border: 1px solid #d9d9d9; border-radius: 4px; padding: 2px 6px; font-family: monospace;">Enter</kbd> to next, <kbd style="background: #fff; border: 1px solid #d9d9d9; border-radius: 4px; padding: 2px 6px; font-family: monospace;">Esc</kbd> to cancel
      </div>
      <div style="display: flex; gap: 12px;">
        <button type="button" class="vf-cancel-btn" style="padding: 8px 20px; font-size: 14px; border: 1px solid #d9d9d9; border-radius: 6px; background: #fff; cursor: pointer; color: #333;">Cancel</button>
        <button type="button" class="vf-submit-btn" style="padding: 8px 20px; font-size: 14px; border: none; border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; cursor: pointer;">Insert Prompt</button>
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
      // Enter key navigation - only for textareas, not submit button
      if (target.classList.contains('vf-variable-input')) {
        e.preventDefault();
        const currentIndex = parseInt(target.dataset.index || '0', 10);
        focusNext(currentIndex);
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || target.classList.contains('vf-submit-btn'))) {
      // Ctrl+Enter or Enter on submit button to submit
      if (canSubmit()) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };
  
  // Attach event listeners
  modal.addEventListener('click', handleOverlayClick);
  
  const cancelBtn = content.querySelector('.vf-cancel-btn');
  cancelBtn?.addEventListener('click', handleCancel);
  
  const submitBtn = content.querySelector('.vf-submit-btn') as HTMLButtonElement;
  submitBtn?.addEventListener('click', handleSubmit);
  
  // Variable inputs - store references for navigation
  const variableInputs = content.querySelectorAll('.vf-variable-input');
  variableInputs.forEach((input, index) => {
    activeInputRefs.push(input as HTMLElement);
    
    input.addEventListener('input', handleInputChange);
    input.addEventListener('focus', (e) => {
      (e.target as HTMLElement).style.borderColor = '#667eea';
    });
    input.addEventListener('blur', (e) => {
      (e.target as HTMLElement).style.borderColor = '#d9d9d9';
    });
    input.addEventListener('keydown', handleKeyDown);
  });
  
  document.addEventListener('keydown', handleKeyDown);
  
  // Store event handlers for cleanup
  (modal as any)._cleanupHandlers = { handleKeyDown };
  
  // Initialize preview
  updatePreview();
  
  // Focus first input
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
    // Remove keydown listener
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