/**
 * VariableInputModal - React Component for Variable Input
 * 
 * A React component that provides a modal for filling in template variables
 * before inserting prompts into input fields.
 * 
 * Features:
 * - React state management for form values
 * - Shadow DOM for complete style isolation from the host page
 * - Live preview with syntax highlighting
 * - Keyboard navigation (Enter to jump between fields)
 * - Copy to clipboard functionality
 * - Light/dark mode support
 * 
 * Supports syntax:
 * - <VAR name="variable_name"></VAR> - Required variable
 * - <VAR name="variable_name" defaultValue="default_value"></VAR> - Variable with default value
 * - <VAR name="variable_name" description="Description text"></VAR> - Variable with description
 */

import React, { useState, useEffect, useRef, useCallback, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Variable, interpolate, generatePreviewSegments, getUniqueVariables } from '../../utils/template-parser';
// Note: CSS is loaded via link element in showVariableInput

export interface VariableInputOptions {
  prompt: {
    id: string;
    title: string;
    content: string;
  };
  onConfirm: (filledContent: string) => void;
  onCancel: () => void;
}

interface VariableInputModalProps {
  options: VariableInputOptions;
  variables: Variable[];
  initialValues?: Record<string, string>;
}

interface VariableInputItemProps {
  variable: Variable;
  value: string;
  onChange: (name: string, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent, index: number) => void;
  index: number;
  inputRefs: React.RefObject<(HTMLTextAreaElement | null)[]>;
}

function VariableInputItem({ variable, value, onChange, onKeyDown, index, inputRefs }: VariableInputItemProps) {
  return (
    <div className="vf-variable-item">
      <span className="vf-variable-name">{`\${${variable.name}}`}</span>
      
      {variable.description && (
        <div className="vf-variable-description">{variable.description}</div>
      )}
      
      <div className="vf-badges">
        {variable.defaultValue !== undefined ? (
          <span className="vf-badge vf-badge-default">
            Default: {variable.defaultValue}
          </span>
        ) : (
          <span className="vf-badge vf-badge-required">Required</span>
        )}
      </div>
      
      <textarea
        ref={(el) => { 
          // eslint-disable-next-line react-hooks/immutability
          inputRefs.current[index] = el; 
        }}
        className="vf-variable-input"
        data-variable={variable.name}
        data-index={index}
        value={value}
        onChange={(e) => onChange(variable.name, e.target.value)}
        onKeyDown={(e) => onKeyDown(e, index)}
        placeholder={variable.defaultValue ? variable.defaultValue : 'Enter value...'}
        rows={3}
      />
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

export function VariableInputModal({ options, variables, initialValues = {} }: VariableInputModalProps) {
  const { prompt, onConfirm, onCancel } = options;
  
  // Initialize values with defaults and initial values
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const v of variables) {
      initial[v.name] = initialValues[v.name] ?? v.defaultValue ?? '';
    }
    return initial;
  });
  
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  
  // Mount animation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  
  // Check if all required variables are filled
  const canSubmit = variables.every(v => {
    const value = values[v.name];
    return value !== undefined && value !== '';
  });
  
  // Handle value change for a specific variable
  const handleChange = useCallback((name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);
  
  // Handle submit
  const handleSubmit = useCallback(() => {
    const filledContent = interpolate(prompt.content, values);
    onConfirm(filledContent);
  }, [prompt.content, values, onConfirm]);
  
  // Always keep the latest handleSubmit accessible without recreating handleKeyDown
  const handleSubmitRef = useRef(handleSubmit);
  // eslint-disable-next-line react-hooks/refs
  handleSubmitRef.current = handleSubmit;

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextIndex = e.shiftKey ? index - 1 : index + 1;
      if (nextIndex >= 0 && nextIndex < variables.length) {
        inputRefs.current[nextIndex]?.focus();
      } else if (nextIndex >= variables.length && canSubmit) {
        handleSubmitRef.current();
      } else if (nextIndex < 0) {
        inputRefs.current[0]?.focus();
      }
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      const nextIndex = index + 1;
      if (nextIndex < variables.length) {
        inputRefs.current[nextIndex]?.focus();
      } else if (canSubmit) {
        handleSubmitRef.current();
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canSubmit) {
        handleSubmitRef.current();
      }
    }
  }, [variables.length, canSubmit]);
  
  // Handle cancel
  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);
  
  // Handle overlay click (close on backdrop click)
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }, [handleCancel]);
  
  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    const text = interpolate(prompt.content, values);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [prompt.content, values]);
  
  // ESC key handling is done in content.ts via handleKeyDown
  // No need for a separate listener in the React component
  
  // Focus first input on mount
  useEffect(() => {
    if (mounted && inputRefs.current[0]) {
      // Small delay to ensure animation is visible
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mounted]);
  
  // Generate preview segments
  const previewSegments = generatePreviewSegments(prompt.content, values);
  
  return (
    <div className="vf-modal-overlay" onClick={handleOverlayClick}>
      <div className="vf-modal-content">
        {/* Header */}
        <div className="vf-header">
          <div className="vf-header-title">💬 Fill Variables</div>
          <div className="vf-header-subtitle">{prompt.title}</div>
        </div>
        
        {/* Body */}
        <div className="vf-body">
          <div className="vf-body-inner">
            {/* Variable Inputs */}
            {variables.length > 0 ? (
              <>
                <div className="vf-section-title">📋 Variable Values</div>
                {variables.map((variable, index) => (
                  <VariableInputItem
                    key={variable.name}
                    variable={variable}
                    value={values[variable.name] || ''}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    index={index}
                    inputRefs={inputRefs}
                  />
                ))}
              </>
            ) : (
              <div className="vf-empty-state">
                This template does not contain any variables
              </div>
            )}
            
            {/* Preview Section */}
            <div className="vf-section-header">
              <div className="vf-section-title">👁️ Preview</div>
              <button 
                type="button" 
                className={`vf-copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            
            <div className="vf-preview">
              {previewSegments.map((segment, index) => {
                if (segment.type === 'text') {
                  return (
                    <span key={index} className="vf-preview-text">
                      {segment.content}
                    </span>
                  );
                } else {
                  // Variable segment
                  const isPlaceholder = !segment.variable;
                  return (
                    <span 
                      key={index} 
                      className={isPlaceholder ? 'vf-preview-placeholder' : 'vf-preview-variable'}
                    >
                      {segment.content}
                    </span>
                  );
                }
              })}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="vf-footer">
          <div className="vf-footer-hint">
            <kbd>Tab</kbd> / <kbd>Enter</kbd> next &middot; <kbd>Esc</kbd> cancel
          </div>
          <div className="vf-footer-actions">
            <button type="button" className="vf-cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
            <button 
              type="button" 
              className="vf-submit-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              ✨ Insert Prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Global references for cleanup - these are set when modal is shown
let reactRoot: Root | null = null;
let hostElement: HTMLElement | null = null;

/**
 * Create and mount the VariableInputModal to Shadow DOM
 * This function is the entry point for using the modal
 * 
 * Note: React is bundled with the content script, so we import it directly.
 * For Chrome extension content scripts, we use ReactDOM.createRoot
 * with Shadow DOM for style isolation.
 */
export function showVariableInput(options: VariableInputOptions): void {
  // Parse variables from prompt content
  const variables = getUniqueVariables(options.prompt.content);
  
  // Create host element for Shadow DOM
  hostElement = document.createElement('div');
  hostElement.id = 'promptflow-variable-input-host';
  hostElement.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; overflow: visible; z-index: 2147483647;';
  document.body.appendChild(hostElement);
  
  // Create Shadow DOM
  const shadowRoot = hostElement.attachShadow({ mode: 'open' });
  
  // Load the CSS stylesheet
  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = chrome.runtime.getURL('VariableInputModal.css');
  shadowRoot.appendChild(linkEl);
  
  // Create container for React app inside Shadow DOM
  const container = document.createElement('div');
  shadowRoot.appendChild(container);
  
  // Create React root and render
  reactRoot = createRoot(container);
  
  reactRoot.render(
    createElement(VariableInputModal, {
      options,
      variables,
      initialValues: {}
    })
  );
}

/**
 * Hide the VariableInputModal
 */
export function hideVariableInput(): void {
  // Unmount React root
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  
  // Remove host element
  if (hostElement) {
    hostElement.remove();
    hostElement = null;
  }
}

// Re-export template parser utilities
export { getUniqueVariables, interpolate, hasVariables, generatePreviewSegments } from '../../utils/template-parser';
export type { Variable, PreviewSegment } from '../../utils/template-parser';
