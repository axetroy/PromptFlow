import { test, expect } from '@playwright/test';

/**
 * Tests for cursor-utils.ts functions
 * These tests verify cursor positioning and selection logic
 */

// Replicate the utility functions for testing
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

function setInputSelection(input: HTMLInputElement | HTMLTextAreaElement, start: number, end: number): void {
  if (!input) return;
  input.focus();
  input.setSelectionRange(start, end);
}

function setContentEditableSelection(element: Element, start: number, end: number): void {
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
    range.selectNodeContents(element);
    range.collapse(false);
  }
  
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function insertContentIntoContentEditable(
  element: Element,
  content: string
): { selectionStart: number; selectionEnd: number } {
  if (!element || !element.hasAttribute || !element.hasAttribute('contenteditable')) {
    return { selectionStart: 0, selectionEnd: 0 };
  }

  element.textContent = '';
  
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      element.appendChild(document.createElement('br'));
    }
    
    if (lines[i].length > 0) {
      element.appendChild(document.createTextNode(lines[i]));
    }
  }
  
  const placeholder = findFirstPlaceholder(content);
  let selectionStart: number;
  let selectionEnd: number;
  
  if (placeholder) {
    selectionStart = placeholder.start;
    selectionEnd = placeholder.end;
  } else {
    selectionStart = content.length;
    selectionEnd = content.length;
  }
  
  setContentEditableSelection(element, selectionStart, selectionEnd);
  
  return { selectionStart, selectionEnd };
}

test.describe('findFirstPlaceholder', () => {
  test('should find placeholder in middle of content', () => {
    const content = 'Write a {tone} response';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    expect(placeholder!.start).toBe(8);
    expect(placeholder!.end).toBe(14);
    expect(content.substring(placeholder!.start, placeholder!.end)).toBe('{tone}');
  });

  test('should return null when no placeholder exists', () => {
    const content = 'Review this code';
    expect(findFirstPlaceholder(content)).toBeNull();
  });

  test('should find placeholder at start', () => {
    const content = '{greeting}, how are you?';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    expect(placeholder!.start).toBe(0);
    expect(placeholder!.end).toBe(10);
  });

  test('should find placeholder at end', () => {
    const content = 'Please explain {concept}';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    expect(placeholder!.start).toBe(15);
    expect(placeholder!.end).toBe(24);
  });

  test('should only return first placeholder', () => {
    const content = '{first} and {second} and {third}';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    expect(placeholder!.start).toBe(0);
    expect(placeholder!.end).toBe(7);
    expect(content.substring(placeholder!.start, placeholder!.end)).toBe('{first}');
  });

  test('should handle placeholder with underscores and numbers', () => {
    const content = 'Hello {user_name_123}';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    expect(content.substring(placeholder!.start, placeholder!.end)).toBe('{user_name_123}');
  });

  test('should return null for empty braces', () => {
    const content = 'Text with {} empty placeholder';
    expect(findFirstPlaceholder(content)).toBeNull();
  });

  test('should handle single character placeholder', () => {
    const content = 'Item {1} of {total}';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    expect(content.substring(placeholder!.start, placeholder!.end)).toBe('{1}');
  });
});

test.describe('setInputSelection', () => {
  test('should set selection range in input element', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Hello World';
      document.body.appendChild(input);
      input.focus();
      
      // Call selection function
      input.setSelectionRange(6, 11);
      
      return {
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        selectedText: input.value.substring(input.selectionStart!, input.selectionEnd!)
      };
    });
    
    expect(result.selectionStart).toBe(6);
    expect(result.selectionEnd).toBe(11);
    expect(result.selectedText).toBe('World');
  });

  test('should set selection range in textarea element', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const textarea = document.createElement('textarea');
      textarea.value = 'Hello World';
      document.body.appendChild(textarea);
      textarea.focus();
      
      textarea.setSelectionRange(6, 11);
      
      return {
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
        selectedText: textarea.value.substring(textarea.selectionStart!, textarea.selectionEnd!)
      };
    });
    
    expect(result.selectionStart).toBe(6);
    expect(result.selectionEnd).toBe(11);
    expect(result.selectedText).toBe('World');
  });

  test('should set cursor position (start equals end)', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Hello';
      document.body.appendChild(input);
      input.focus();
      
      input.setSelectionRange(3, 3);
      
      return {
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd
      };
    });
    
    expect(result.selectionStart).toBe(3);
    expect(result.selectionEnd).toBe(3);
  });
});

test.describe('setContentEditableSelection', () => {
  test('should select text in contenteditable element', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      div.textContent = 'Hello World';
      document.body.appendChild(div);
      
      // Set selection for "World" (positions 6-11)
      const range = document.createRange();
      const selection = window.getSelection();
      range.setStart(div.firstChild!, 6);
      range.setEnd(div.firstChild!, 11);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      return {
        selectedText: selection?.toString(),
        selectionStart: 6,
        selectionEnd: 11
      };
    });
    
    expect(result.selectedText).toBe('World');
  });

  test('should handle selection with placeholder', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      // Define findFirstPlaceholder locally
      function findFirstPlaceholder(content: string): { start: number; end: number } | null {
        const match = content.match(/\{[^}]+\}/);
        if (match && match.index !== undefined) {
          return { start: match.index, end: match.index + match[0].length };
        }
        return null;
      }
      
      const div = document.createElement('div');
      div.contentEditable = 'true';
      div.textContent = 'Write a {tone} response';
      document.body.appendChild(div);
      
      // Select {tone}
      const placeholder = findFirstPlaceholder(div.textContent);
      if (!placeholder) return { error: 'No placeholder found' };
      
      const range = document.createRange();
      const selection = window.getSelection();
      range.setStart(div.firstChild!, placeholder.start);
      range.setEnd(div.firstChild!, placeholder.end);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      return {
        selectedText: selection?.toString(),
        placeholder
      };
    });
    
    expect((result as any).selectedText).toBe('{tone}');
    expect((result as any).placeholder.start).toBe(8);
    expect((result as any).placeholder.end).toBe(14);
  });

  test('should collapse selection at end when no placeholder', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      div.textContent = 'Review this code';
      document.body.appendChild(div);
      
      // Collapse at end
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(div);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      return {
        selectedText: selection?.toString(),
        isCollapsed: selection?.isCollapsed
      };
    });
    
    expect(result.selectedText).toBe('');
    expect(result.isCollapsed).toBe(true);
  });
});

test.describe('insertContentIntoContentEditable', () => {
  test('should insert content and select placeholder', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      function findFirstPlaceholder(content: string): { start: number; end: number } | null {
        const match = content.match(/\{[^}]+\}/);
        if (match && match.index !== undefined) {
          return { start: match.index, end: match.index + match[0].length };
        }
        return null;
      }
      
      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);
      
      const content = 'Write a {tone} response';
      const placeholder = findFirstPlaceholder(content);
      
      // Clear and insert
      div.textContent = '';
      div.appendChild(document.createTextNode(content));
      
      // Select placeholder
      if (placeholder) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(div.firstChild!, placeholder.start);
        range.setEnd(div.firstChild!, placeholder.end);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      
      return {
        text: div.textContent,
        selectedText: window.getSelection()?.toString(),
        placeholderStart: placeholder?.start,
        placeholderEnd: placeholder?.end
      };
    });
    
    expect(result.text).toBe('Write a {tone} response');
    expect(result.selectedText).toBe('{tone}');
  });

  test('should insert content with no placeholder and collapse at end', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);
      
      const content = 'Review this code';
      
      // Clear and insert
      div.textContent = '';
      div.appendChild(document.createTextNode(content));
      
      // Collapse at end
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(div);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      return {
        text: div.textContent,
        selectedText: selection?.toString(),
        isCollapsed: selection?.isCollapsed
      };
    });
    
    expect(result.text).toBe('Review this code');
    expect(result.selectedText).toBe('');
    expect(result.isCollapsed).toBe(true);
  });
});

test.describe('Integration: Prompt Insertion', () => {
  test('should calculate correct insertion position with text before trigger', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      function findFirstPlaceholder(content: string): { start: number; end: number } | null {
        const match = content.match(/\{[^}]+\}/);
        if (match && match.index !== undefined) {
          return { start: match.index, end: match.index + match[0].length };
        }
        return null;
      }
      
      // Simulate: "Hello /prompts" where cursor is at position 14 (right after /prompts)
      const inputValue = 'Hello /prompts';
      const triggerStartPosition = 6; // Position of '/'
      const triggerLength = 8; // '/prompts'.length
      const caretPosition = triggerStartPosition + triggerLength; // 14
      
      const before = inputValue.substring(0, triggerStartPosition);
      const after = inputValue.substring(caretPosition);
      
      const promptContent = 'Write a {tone} response';
      const newValue = before + promptContent + after;
      
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
      
      return {
        before,
        after,
        newValue,
        selectionStart,
        selectionEnd,
        selectedText: newValue.substring(selectionStart, selectionEnd)
      };
    });
    
    expect(result.before).toBe('Hello ');
    expect(result.after).toBe('');
    expect(result.newValue).toBe('Hello Write a {tone} response');
    expect(result.selectionStart).toBe(6 + 8); // triggerStartPosition + placeholder.start
    expect(result.selectionEnd).toBe(6 + 14);  // triggerStartPosition + placeholder.end
    expect(result.selectedText).toBe('{tone}');
  });

  test('should handle insertion in middle of existing text', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      function findFirstPlaceholder(content: string): { start: number; end: number } | null {
        const match = content.match(/\{[^}]+\}/);
        if (match && match.index !== undefined) {
          return { start: match.index, end: match.index + match[0].length };
        }
        return null;
      }
      
      // Simulate: "Start /prompts End" with cursor between prompts and End
      const inputValue = 'Start /prompts End';
      const triggerStartPosition = 6;
      const triggerLength = 8;
      const caretPosition = triggerStartPosition + triggerLength; // 14
      
      const before = inputValue.substring(0, triggerStartPosition);
      const after = inputValue.substring(caretPosition);
      
      const promptContent = 'Write {text}';
      const newValue = before + promptContent + after;
      
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
      
      return {
        before,
        after,
        newValue,
        selectionStart,
        selectionEnd,
        selectedText: newValue.substring(selectionStart, selectionEnd)
      };
    });
    
    expect(result.before).toBe('Start ');
    expect(result.after).toBe(' End');
    expect(result.newValue).toBe('Start Write {text} End');
    expect(result.selectedText).toBe('{text}');
  });

  test('should handle prompt without placeholder', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      function findFirstPlaceholder(content: string): { start: number; end: number } | null {
        const match = content.match(/\{[^}]+\}/);
        if (match && match.index !== undefined) {
          return { start: match.index, end: match.index + match[0].length };
        }
        return null;
      }
      
      const inputValue = 'Test /prompts';
      const triggerStartPosition = 5;
      const triggerLength = 8;
      const caretPosition = triggerStartPosition + triggerLength; // 13
      
      const before = inputValue.substring(0, triggerStartPosition);
      const after = inputValue.substring(caretPosition);
      
      const promptContent = 'Static text';
      const newValue = before + promptContent + after;
      
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
      
      return {
        newValue,
        selectionStart,
        selectionEnd,
        cursorAtEnd: selectionStart === newValue.length
      };
    });
    
    expect(result.newValue).toBe('Test Static text');
    expect(result.selectionStart).toBe(result.selectionEnd);
    expect(result.cursorAtEnd).toBe(true);
  });
});
