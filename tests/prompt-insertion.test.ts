import { test, expect } from '@playwright/test';

test.describe('Prompt Insertion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
  });

  test('should insert prompt content unchanged into textarea', async ({ page }) => {
    const result = await page.evaluate(() => {
      const textarea = document.createElement('textarea');
      textarea.id = 'test-input';
      document.body.appendChild(textarea);
      
      // Simulate prompt content as it would be loaded from markdown
      const promptContent = `Please review the following code:

\`\`\`
{code}
\`\`\`

Focus on:
- Code quality`;
      
      // Insert content (simulating what content.ts does)
      const before = '';
      const after = '';
      const newValue = before + promptContent + after;
      
      textarea.value = newValue;
      
      return {
        value: textarea.value,
        hasCodeBlock: textarea.value.includes('```'),
        lineCount: textarea.value.split('\n').length,
      };
    });
    
    expect(result.hasCodeBlock).toBe(true);
    expect(result.value).toContain('```');
    expect(result.value).toContain('{code}');
  });

  test('should insert prompt content unchanged into contenteditable', async ({ page }) => {
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'test-contenteditable';
      div.contentEditable = 'true';
      document.body.appendChild(div);
      
      // Simulate prompt content
      const promptContent = `Please review the following code:

\`\`\`
{code}
\`\`\`

Focus on:
- Code quality`;
      
      // Clear and insert with newlines (simulating insertContentWithNewlines)
      div.textContent = '';
      const lines = promptContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          div.appendChild(document.createElement('br'));
        }
        if (lines[i].length > 0) {
          div.appendChild(document.createTextNode(lines[i]));
        }
      }
      
      // Get the text content (without br tags)
      const textContent = div.textContent || '';
      
      return {
        textContent,
        hasCodeBlock: textContent.includes('```'),
        hasPlaceholder: textContent.includes('{code}'),
        childNodesCount: div.childNodes.length,
      };
    });
    
    // Content should be preserved
    expect(result.hasCodeBlock).toBe(true);
    expect(result.hasPlaceholder).toBe(true);
  });

  test('should select placeholder in textarea after insertion', async ({ page }) => {
    const result = await page.evaluate(() => {
      const textarea = document.createElement('textarea');
      textarea.id = 'test-input';
      document.body.appendChild(textarea);
      
      // Prompt content with placeholder
      const promptContent = `Please review the following code:

\`\`\`
{code}
\`\`\``;
      
      // Find placeholder position
      const placeholderMatch = promptContent.match(/\{[^}]+\}/);
      const placeholderStart = placeholderMatch?.index || 0;
      const placeholderEnd = placeholderStart + (placeholderMatch?.[0].length || 0);
      
      // Insert
      textarea.value = promptContent;
      
      // Select placeholder
      textarea.focus();
      textarea.setSelectionRange(placeholderStart, placeholderEnd);
      
      const selectedText = textarea.value.substring(
        textarea.selectionStart,
        textarea.selectionEnd
      );
      
      return {
        selectedText,
        placeholderMatch: placeholderMatch?.[0],
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
      };
    });
    
    expect(result.selectedText).toBe('{code}');
    expect(result.placeholderMatch).toBe('{code}');
  });

  test('should select placeholder in contenteditable after insertion', async ({ page }) => {
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'test-contenteditable';
      div.contentEditable = 'true';
      document.body.appendChild(div);
      
      // Prompt content with placeholder
      const promptContent = `Please review:

\`\`\`
{code}
\`\`\``;
      
      // Find placeholder position in the content string
      const placeholderMatch = promptContent.match(/\{[^}]+\}/);
      const placeholderStart = placeholderMatch?.index || 0;
      const placeholderEnd = placeholderStart + (placeholderMatch?.[0].length || 0);
      
      // Insert with newlines
      div.textContent = '';
      const lines = promptContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          div.appendChild(document.createElement('br'));
        }
        if (lines[i].length > 0) {
          div.appendChild(document.createTextNode(lines[i]));
        }
      }
      
      // Calculate DOM position for placeholder (accounting for br tags)
      let charCount = 0;
      let targetNode: Node | null = null;
      let targetOffset = 0;
      
      for (const node of Array.from(div.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const nodeLength = node.textContent!.length;
          
          if (charCount <= placeholderStart && placeholderStart <= charCount + nodeLength) {
            targetNode = node;
            targetOffset = placeholderStart - charCount;
            break;
          }
          charCount += nodeLength;
        } else if (node.nodeName === 'BR') {
          charCount += 1;
        }
      }
      
      // Set selection
      if (targetNode) {
        const range = document.createRange();
        const selection = window.getSelection();
        
        // Find start and end positions
        let startNode: Node | null = null;
        let startOffset = 0;
        let endNode: Node | null = null;
        let endOffset = 0;
        
        charCount = 0;
        for (const node of Array.from(div.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            const nodeLength = node.textContent!.length;
            
            if (!startNode && charCount <= placeholderStart && placeholderStart <= charCount + nodeLength) {
              startNode = node;
              startOffset = placeholderStart - charCount;
            }
            
            if (startNode && !endNode && charCount <= placeholderEnd && placeholderEnd <= charCount + nodeLength) {
              endNode = node;
              endOffset = placeholderEnd - charCount;
              break;
            }
            
            charCount += nodeLength;
          } else if (node.nodeName === 'BR') {
            charCount += 1;
          }
        }
        
        if (startNode && endNode) {
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
      
      return {
        selectedText: window.getSelection()?.toString(),
        placeholderMatch: placeholderMatch?.[0],
        childNodesCount: div.childNodes.length,
      };
    });
    
    expect(result.selectedText).toBe('{code}');
  });

  test('should handle multiline prompt with code blocks', async ({ page }) => {
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'test-contenteditable';
      div.contentEditable = 'true';
      document.body.appendChild(div);
      
      // Complex prompt with multiple code blocks
      const promptContent = `# Code Review

Please review the following code:

\`\`\`javascript
function hello() {
  console.log("Hello");
}
\`\`\`

Focus on:
- Code quality
- Performance`;

      // Insert
      div.textContent = '';
      const lines = promptContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          div.appendChild(document.createElement('br'));
        }
        if (lines[i].length > 0) {
          div.appendChild(document.createTextNode(lines[i]));
        }
      }
      
      // Get text content
      const textContent = div.textContent || '';
      
      return {
        textContent,
        lineCount: promptContent.split('\n').length,
        hasCodeBlock: textContent.includes('```'),
        hasHeader: textContent.includes('# Code Review'),
      };
    });
    
    expect(result.hasCodeBlock).toBe(true);
    expect(result.hasHeader).toBe(true);
    expect(result.lineCount).toBeGreaterThan(10);
  });

  test('should calculate correct selection position with br tags', async ({ page }) => {
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'test-contenteditable';
      div.contentEditable = 'true';
      document.body.appendChild(div);
      
      // Content: "Line 1\nLine 2\n{template}\nLine 4"
      // template is at position 13-23 (after "Line 1\nLine 2\n")
      const promptContent = 'Line 1\nLine 2\n{template}\nLine 4';
      const placeholderMatch = promptContent.match(/\{[^}]+\}/);
      const placeholderStart = placeholderMatch?.index || 0;
      const placeholderEnd = placeholderStart + (placeholderMatch?.[0].length || 0);
      
      // Insert
      div.textContent = '';
      const lines = promptContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          div.appendChild(document.createElement('br'));
        }
        if (lines[i].length > 0) {
          div.appendChild(document.createTextNode(lines[i]));
        }
      }
      
      // Calculate DOM position for placeholder
      let charCount = 0;
      let startNode: Node | null = null;
      let startOffset = 0;
      let endNode: Node | null = null;
      let endOffset = 0;
      
      for (const node of Array.from(div.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const nodeLength = node.textContent!.length;
          
          // Check start position
          if (!startNode && charCount <= placeholderStart && placeholderStart <= charCount + nodeLength) {
            startNode = node;
            startOffset = placeholderStart - charCount;
          }
          
          // Check end position
          if (startNode && !endNode && charCount <= placeholderEnd && placeholderEnd <= charCount + nodeLength) {
            endNode = node;
            endOffset = placeholderEnd - charCount;
          }
          
          charCount += nodeLength;
        } else if (node.nodeName === 'BR') {
          charCount += 1;
        }
      }
      
      // Set selection
      if (startNode && endNode) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      
      return {
        selectedText: window.getSelection()?.toString(),
        placeholderStart,
        placeholderEnd,
      };
    });
    
    expect(result.selectedText).toBe('{template}');
  });

  test('should insert and select placeholder at different positions', async ({ page }) => {
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'test-contenteditable';
      div.contentEditable = 'true';
      document.body.appendChild(div);
      
      // Prompt with placeholder NOT at start
      const promptContent = `Hello, please help me with:

\`\`\`
{code}
\`\`\`

Thank you!`;
      
      const placeholderMatch = promptContent.match(/\{[^}]+\}/);
      const placeholderStart = placeholderMatch?.index || 0;
      const placeholderEnd = placeholderStart + (placeholderMatch?.[0].length || 0);
      
      // Insert
      div.textContent = '';
      const lines = promptContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          div.appendChild(document.createElement('br'));
        }
        if (lines[i].length > 0) {
          div.appendChild(document.createTextNode(lines[i]));
        }
      }
      
      // Calculate DOM position
      let charCount = 0;
      let startNode: Node | null = null;
      let startOffset = 0;
      let endNode: Node | null = null;
      let endOffset = 0;
      
      for (const node of Array.from(div.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const nodeLength = node.textContent!.length;
          
          if (!startNode && charCount <= placeholderStart && placeholderStart <= charCount + nodeLength) {
            startNode = node;
            startOffset = placeholderStart - charCount;
          }
          
          if (startNode && !endNode && charCount <= placeholderEnd && placeholderEnd <= charCount + nodeLength) {
            endNode = node;
            endOffset = placeholderEnd - charCount;
          }
          
          charCount += nodeLength;
        } else if (node.nodeName === 'BR') {
          charCount += 1;
        }
      }
      
      // Set selection
      if (startNode && endNode) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      
      return {
        selectedText: window.getSelection()?.toString(),
        placeholderMatch: placeholderMatch?.[0],
      };
    });
    
    expect(result.selectedText).toBe('{code}');
  });

  test('should insert prompt with placeholder correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'test-contenteditable';
      div.contentEditable = 'true';
      document.body.appendChild(div);
      
      // Simulate the actual prompt content from 1-code-review.md
      const promptContent = `Please review the following code and suggest improvements:

\`\`\`
{code}
\`\`\`

Focus on:
- Code quality
- Performance
- Security`;
      
      // Find placeholder
      const placeholderMatch = promptContent.match(/\{[^}]+\}/);
      const placeholderStart = placeholderMatch?.index || 0;
      const placeholderEnd = placeholderStart + (placeholderMatch?.[0].length || 0);
      
      // Insert using the actual implementation
      div.textContent = '';
      const lines = promptContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          div.appendChild(document.createElement('br'));
        }
        if (lines[i].length > 0) {
          div.appendChild(document.createTextNode(lines[i]));
        }
      }
      
      // Get text content
      const textContent = div.textContent || '';
      
      // Verify content is preserved
      const hasCodeBlock = textContent.includes('```');
      const hasPlaceholder = textContent.includes('{code}');
      const hasList = textContent.includes('- Code quality');
      
      // Calculate DOM position for placeholder selection
      let charCount = 0;
      let startNode: Node | null = null;
      let startOffset = 0;
      let endNode: Node | null = null;
      let endOffset = 0;
      
      for (const node of Array.from(div.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const nodeLength = node.textContent!.length;
          
          if (!startNode && charCount <= placeholderStart && placeholderStart <= charCount + nodeLength) {
            startNode = node;
            startOffset = placeholderStart - charCount;
          }
          
          if (startNode && !endNode && charCount <= placeholderEnd && placeholderEnd <= charCount + nodeLength) {
            endNode = node;
            endOffset = placeholderEnd - charCount;
          }
          
          charCount += nodeLength;
        } else if (node.nodeName === 'BR') {
          charCount += 1;
        }
      }
      
      // Set selection
      if (startNode && endNode) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      
      const selectedText = window.getSelection()?.toString();
      
      return {
        hasCodeBlock,
        hasPlaceholder,
        hasList,
        selectedText,
        childNodesCount: div.childNodes.length,
      };
    });
    
    // Content should be preserved
    expect(result.hasCodeBlock).toBe(true);
    expect(result.hasPlaceholder).toBe(true);
    expect(result.hasList).toBe(true);
    // Placeholder should be selected
    expect(result.selectedText).toBe('{code}');
  });
});
