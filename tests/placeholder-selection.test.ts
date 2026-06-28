import { test, expect } from '@playwright/test';

/**
 * Tests for placeholder selection functionality.
 * When a prompt with {placeholder} is inserted, the first placeholder should be selected.
 */
test.describe('Placeholder Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  /**
   * Helper function to find first placeholder in content
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
   * Helper function to set selection in an element
   */
  async function setSelection(element: Element, start: number, end: number): Promise<void> {
    await (element as HTMLElement).evaluate((el, [s, e]) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.setSelectionRange(s, e);
        el.focus();
      } else if (el.hasAttribute('contenteditable')) {
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
            
            if (!foundStart && s <= nextCount) {
              range.setStart(node, s - charCount);
              foundStart = true;
            }
            if (foundStart && !foundEnd && e <= nextCount) {
              range.setEnd(node, e - charCount);
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

        traverseNodes(el);
        if (!foundEnd) {
          range.selectNodeContents(el);
          range.collapse(false);
        }
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }, [start, end]);
  }

  test('should find placeholder in prompt content', () => {
    const content = 'Write a {tone} explanation about {topic}';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    expect(placeholder!.start).toBe(8);   // Position of '{' in "{tone}"
    expect(placeholder!.end).toBe(14);    // Position after '}' in "{tone}"
    expect(content.substring(placeholder!.start, placeholder!.end)).toBe('{tone}');
  });

  test('should return null when no placeholder exists', () => {
    const content = 'Review this code and suggest improvements';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).toBeNull();
  });

  test('should find placeholder at the start of content', () => {
    const content = '{greeting}, how are you?';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    expect(placeholder!.start).toBe(0);
    expect(placeholder!.end).toBe(10);    // "{greeting}" is 10 chars
    expect(content.substring(placeholder!.start, placeholder!.end)).toBe('{greeting}');
  });

  test('should select only the first placeholder when multiple exist', () => {
    const content = 'The {adjective} {noun} jumped over the {obstacle}';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    // Should select only {adjective}, not {adjective} {noun}
    expect(placeholder!.start).toBe(4);
    expect(placeholder!.end).toBe(15);
    expect(content.substring(placeholder!.start, placeholder!.end)).toBe('{adjective}');
  });

  test('should handle placeholder at the end of content', () => {
    const content = 'Please explain {concept}';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    // "Please explain " is 15 chars, "{concept}" is 9 chars
    expect(placeholder!.start).toBe(15);
    expect(placeholder!.end).toBe(24);
    expect(content.substring(placeholder!.start, placeholder!.end)).toBe('{concept}');
  });

  test('should select placeholder in input element', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.style.cssText = 'position: fixed; top: 100px; left: 100px; width: 400px; font-size: 16px;';
      document.body.appendChild(input);
      
      const content = 'Write a {tone} response';
      const match = content.match(/\{[^}]+\}/);
      const placeholder = match && match.index !== undefined 
        ? { start: match.index, end: match.index + match[0].length }
        : null;
      
      input.value = content;
      input.setSelectionRange(
        placeholder ? placeholder.start : content.length,
        placeholder ? placeholder.end : content.length
      );
      
      return {
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        selectedText: input.value.substring(input.selectionStart!, input.selectionEnd!)
      };
    });
    
    expect(result.selectionStart).toBe(8);
    expect(result.selectionEnd).toBe(14);
    expect(result.selectedText).toBe('{tone}');
  });

  test('should position cursor at end when no placeholder', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.style.cssText = 'position: fixed; top: 100px; left: 100px; width: 400px; font-size: 16px;';
      document.body.appendChild(input);
      
      const content = 'Review this code';
      const match = content.match(/\{[^}]+\}/);
      const placeholder = match && match.index !== undefined 
        ? { start: match.index, end: match.index + match[0].length }
        : null;
      
      input.value = content;
      const cursorPos = placeholder 
        ? placeholder.start 
        : content.length;
      input.setSelectionRange(cursorPos, cursorPos);
      
      return {
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        cursorAtEnd: input.selectionStart === input.value.length
      };
    });
    
    expect(result.selectionStart).toBe(16);  // "Review this code" is 16 chars
    expect(result.selectionEnd).toBe(16);
    expect(result.cursorAtEnd).toBe(true);
  });

  test('should calculate correct position with text before trigger', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.style.cssText = 'position: fixed; top: 100px; left: 100px; width: 400px; font-size: 16px;';
      document.body.appendChild(input);
      
      // Simulating state with trigger at position 12 (after "Hello there ")
      const triggerStartPosition = 12;
      const content = 'Write a {tone} response';
      
      const before = 'Hello there ';
      const after = ' extra text';
      const newValue = before + content + after;
      
      const match = content.match(/\{[^}]+\}/);
      const placeholder = match && match.index !== undefined 
        ? { start: match.index, end: match.index + match[0].length }
        : null;
      
      let selectionStart, selectionEnd;
      if (placeholder) {
        selectionStart = triggerStartPosition + placeholder.start;
        selectionEnd = triggerStartPosition + placeholder.end;
      } else {
        selectionStart = triggerStartPosition + content.length;
        selectionEnd = selectionStart;
      }
      
      input.value = newValue;
      input.setSelectionRange(selectionStart, selectionEnd);
      
      return {
        selectionStart,
        selectionEnd,
        selectedText: newValue.substring(selectionStart, selectionEnd)
      };
    });
    
    // "Hello there " is 12 chars, {tone} starts at 8 in content
    // So selection should be at 12 + 8 = 20 to 12 + 14 = 26
    expect(result.selectionStart).toBe(20);
    expect(result.selectionEnd).toBe(26);
    expect(result.selectedText).toBe('{tone}');
  });

  test('should handle placeholder in textarea element', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const textarea = document.createElement('textarea');
      textarea.style.cssText = 'position: fixed; top: 100px; left: 100px; width: 400px; height: 100px; font-size: 16px;';
      document.body.appendChild(textarea);
      
      const content = 'Explain {concept} in detail';
      const match = content.match(/\{[^}]+\}/);
      const placeholder = match && match.index !== undefined 
        ? { start: match.index, end: match.index + match[0].length }
        : null;
      
      textarea.value = content;
      textarea.setSelectionRange(
        placeholder ? placeholder.start : content.length,
        placeholder ? placeholder.end : content.length
      );
      
      return {
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
        selectedText: textarea.value.substring(textarea.selectionStart!, textarea.selectionEnd!)
      };
    });
    
    // "Explain " is 8 chars, "{concept}" is 9 chars
    expect(result.selectionStart).toBe(8);
    expect(result.selectionEnd).toBe(17);
    expect(result.selectedText).toBe('{concept}');
  });

  test('should handle placeholder in contenteditable element', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      div.style.cssText = 'position: fixed; top: 100px; left: 100px; width: 400px; height: 100px; font-size: 16px;';
      document.body.appendChild(div);
      
      const content = 'Write a {tone} explanation';
      const match = content.match(/\{[^}]+\}/);
      const placeholder = match && match.index !== undefined 
        ? { start: match.index, end: match.index + match[0].length }
        : null;
      
      div.textContent = content;
      
      // Set selection
      const range = document.createRange();
      const selection = window.getSelection();
      
      let charCount = 0;
      let foundStart = false;
      let foundEnd = false;
      const start = placeholder ? placeholder.start : content.length;
      const end = placeholder ? placeholder.end : content.length;
      
      function traverseNodes(node: Node): void {
        if (foundStart && foundEnd) return;
        if (node.nodeType === Node.TEXT_NODE) {
          const nodeLength = node.textContent!.length;
          const nextCount = charCount + nodeLength;
          
          if (!foundStart && start <= nextCount) {
            range.setStart(node, start - charCount);
            foundStart = true;
          }
          if (foundStart && !foundEnd && end <= nextCount) {
            range.setEnd(node, end - charCount);
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
      
      traverseNodes(div);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      // Get selected text
      const selectedText = selection?.toString() || '';
      
      return {
        selectionStart: start,
        selectionEnd: end,
        selectedText
      };
    });
    
    expect(result.selectionStart).toBe(8);
    expect(result.selectionEnd).toBe(14);
    expect(result.selectedText).toBe('{tone}');
  });

  test('should handle empty placeholder name', () => {
    const content = 'Text with {} empty placeholder';
    const placeholder = findFirstPlaceholder(content);
    
    // The regex /\{[^}]+\}/ requires at least one character between braces
    expect(placeholder).toBeNull();
  });

  test('should handle placeholder with special characters', () => {
    const content = 'Hello {user_name_123}, welcome!';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    expect(placeholder!.start).toBe(6);
    // "{user_name_123}" is 15 chars (6 + 15 = 21)
    expect(placeholder!.end).toBe(21);
    expect(content.substring(placeholder!.start, placeholder!.end)).toBe('{user_name_123}');
  });

  test('should handle placeholder with numbers', () => {
    const content = 'Item {1} of {total}';
    const placeholder = findFirstPlaceholder(content);
    
    expect(placeholder).not.toBeNull();
    expect(placeholder!.start).toBe(5);
    expect(placeholder!.end).toBe(8);
    expect(content.substring(placeholder!.start, placeholder!.end)).toBe('{1}');
  });
});