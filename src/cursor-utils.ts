/**
 * Cursor and Selection Utilities
 * Standalone module for handling cursor positioning and text selection
 */

/**
 * Find the first placeholder in content (e.g., {variable})
 */
export function findFirstPlaceholder(content: string): { start: number; end: number } | null {
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
export function setInputSelection(input: HTMLInputElement | HTMLTextAreaElement, start: number, end: number): void {
  if (!input) return;
  input.focus();
  input.setSelectionRange(start, end);
}

/**
 * Set selection in a contenteditable element
 */
export function setContentEditableSelection(element: Element, start: number, end: number): void {
  if (!element || !element.hasAttribute || !element.hasAttribute('contenteditable')) return;

  const range = document.createRange();
  const selection = window.getSelection();
  let charCount = 0;
  let foundStart = false;
  let foundEnd = false;

  function traverseNodes(node: Node): void {
    if (foundStart && foundEnd) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeLength = node.textContent?.length || 0;
      const nextCount = charCount + nodeLength;
      
      if (!foundStart && start <= nextCount) {
        range.setStart(node, Math.max(0, start - charCount));
        foundStart = true;
      }
      if (foundStart && !foundEnd && end <= nextCount) {
        range.setEnd(node, Math.max(0, end - charCount));
        foundEnd = true;
      }
      charCount = nextCount;
    } else {
      for (const child of Array.from(node.childNodes)) {
        traverseNodes(child);
        if (foundStart && foundEnd) break;
      }
    }
  }

  traverseNodes(element);
  
  if (!foundEnd) {
    // If we couldn't find the end position, collapse to end
    range.selectNodeContents(element);
    range.collapse(false);
  }
  
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * Insert content into contenteditable element, properly handling newlines
 * Returns the selection info after insertion
 */
export function insertContentIntoContentEditable(
  element: Element,
  content: string
): { selectionStart: number; selectionEnd: number } {
  if (!element || !element.hasAttribute || !element.hasAttribute('contenteditable')) {
    return { selectionStart: 0, selectionEnd: 0 };
  }

  // Clear the element
  element.textContent = '';
  
  // Insert the new content with proper newline handling
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      element.appendChild(document.createElement('br'));
    }
    
    if (lines[i].length > 0) {
      element.appendChild(document.createTextNode(lines[i]));
    }
  }
  
  // Calculate selection position
  const placeholder = findFirstPlaceholder(content);
  let selectionStart: number;
  let selectionEnd: number;
  
  if (placeholder) {
    // Select the first placeholder
    selectionStart = placeholder.start;
    selectionEnd = placeholder.end;
  } else {
    // Position cursor at end
    selectionStart = content.length;
    selectionEnd = content.length;
  }
  
  // Set the selection
  setContentEditableSelection(element, selectionStart, selectionEnd);
  
  return { selectionStart, selectionEnd };
}

/**
 * Get caret position in input/textarea element
 */
export function getInputCaretPosition(input: HTMLInputElement | HTMLTextAreaElement): number {
  return input.selectionStart ?? 0;
}

/**
 * Set caret position in input/textarea element
 */
export function setInputCaretPosition(input: HTMLInputElement | HTMLTextAreaElement, position: number): void {
  input.focus();
  input.setSelectionRange(position, position);
}

/**
 * Calculate selection range for prompt insertion
 */
export function calculatePromptInsertion(
  triggerStartPosition: number,
  promptContent: string,
  caretPosition: number
): { newValue: string; selectionStart: number; selectionEnd: number; before: string; after: string } {
  // Note: The actual replacement logic depends on external state
  // This is a helper that calculates what the values should be
  const before = ''; // Should be set by caller
  const after = '';  // Should be set by caller
  
  const placeholder = findFirstPlaceholder(promptContent);
  let selectionStart: number;
  let selectionEnd: number;
  
  if (placeholder) {
    selectionStart = triggerStartPosition + placeholder.start;
    selectionEnd = triggerStartPosition + placeholder.end;
  } else {
    selectionStart = triggerStartPosition + promptContent.length;
    selectionEnd = selectionStart;
  }
  
  return { newValue: '', selectionStart, selectionEnd, before, after };
}

/**
 * Insert content into input/textarea element with proper cursor positioning
 */
export function insertContentIntoInput(
  input: HTMLInputElement | HTMLTextAreaElement,
  newValue: string,
  selectionStart: number,
  selectionEnd: number
): void {
  input.value = newValue;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  setInputSelection(input, selectionStart, selectionEnd);
}
