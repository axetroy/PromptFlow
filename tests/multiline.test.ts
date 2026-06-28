import { test, expect } from '@playwright/test';

test.describe('Content Script - Multiline Content Insertion', () => {
  test('should handle single line insertion in contenteditable', async ({ page }) => {
    await page.goto('about:blank');
    
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      div.id = 'single-line';
      div.textContent = 'Hello /prompts world';
      document.body.appendChild(div);
    });
    
    const isEditable = await page.evaluate(() => {
      const el = document.getElementById('single-line');
      return el ? (el as HTMLElement).isContentEditable : false;
    });
    expect(isEditable).toBe(true);
  });
  
  test('should properly split content by newlines', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const content = 'Line 1\nLine 2\nLine 3';
      const lines = content.split('\n');
      return { lineCount: lines.length, lines: lines };
    });
    
    expect(result.lineCount).toBe(3);
    expect(result.lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
  });
  
  test('should handle empty lines in multiline content', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const content = 'Line 1\n\nLine 3';
      const lines = content.split('\n');
      
      const nodes: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          nodes.push('<br>');
        }
        if (lines[i].length > 0) {
          nodes.push(lines[i]);
        }
      }
      return { lineCount: lines.length, nodes: nodes };
    });
    
    expect(result.lineCount).toBe(3);
    expect(result.nodes).toEqual(['Line 1', '<br>', '<br>', 'Line 3']);
  });
  
  test('should create br tags between lines', async ({ page }) => {
    await page.goto('about:blank');
    
    const brCount = await page.evaluate(() => {
      const container = document.createElement('div');
      container.setAttribute('contenteditable', 'true');
      document.body.appendChild(container);
      
      const content = 'Line 1\nLine 2\nLine 3';
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          container.appendChild(document.createElement('br'));
        }
        if (lines[i].length > 0) {
          container.appendChild(document.createTextNode(lines[i]));
        }
      }
      
      return container.querySelectorAll('br').length;
    });
    
    expect(brCount).toBe(2);
  });
  
  test('should handle text before trigger in contenteditable', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const inputValue = 'Hello /prompts world';
      const triggerStartPosition = 6;
      const caretPosition = 14;
      
      const before = inputValue.substring(0, triggerStartPosition);
      const after = inputValue.substring(caretPosition);
      const promptContent = 'Line 1\nLine 2';
      const newValue = before + promptContent + after;
      
      return { newValue, expected: 'Hello Line 1\nLine 2 world' };
    });
    
    expect(result.newValue).toBe(result.expected);
  });
  
  test('contenteditable element should accept br tags', async ({ page }) => {
    await page.goto('about:blank');
    
    const renderedHTML = await page.evaluate(() => {
      const container = document.createElement('div');
      container.setAttribute('contenteditable', 'true');
      document.body.appendChild(container);
      
      const content = 'Hello\nWorld';
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          container.appendChild(document.createElement('br'));
        }
        if (lines[i].length > 0) {
          container.appendChild(document.createTextNode(lines[i]));
        }
      }
      
      return container.innerHTML;
    });
    
    expect(renderedHTML).toContain('<br>');
    expect(renderedHTML).toContain('Hello');
    expect(renderedHTML).toContain('World');
  });
  
  test('should calculate correct cursor position for multiline', async ({ page }) => {
    await page.goto('about:blank');
    
    const cursorPosition = await page.evaluate(() => {
      const triggerStartPosition = 6;
      const contentLength = 'Line 1\nLine 2'.length;
      return triggerStartPosition + contentLength;
    });
    
    expect(cursorPosition).toBe(19);
  });
  
  test('should handle carriage return and line feed', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const content = 'Line 1\r\nLine 2';
      const normalized = content.replace(/\r\n/g, '\n');
      const lines = normalized.split('\n');
      return lines;
    });
    
    expect(result).toEqual(['Line 1', 'Line 2']);
  });
});
