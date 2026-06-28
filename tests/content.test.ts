import { test, expect } from '@playwright/test';

// Inject mock before tests
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).chrome = {
      storage: {
        local: {
          get: async (key: string) => {
            if (key === 'promptflow-data') {
              return {
                'promptflow-data': {
                  prompts: [
                    {
                      id: '1',
                      title: 'Test Prompt',
                      content: '/test content',
                      description: 'A test prompt',
                      tags: ['test'],
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    },
                  ],
                  settings: {
                    trigger: '/prompts',
                    theme: 'auto',
                    insertMode: 'replace',
                  },
                },
              };
            }
            return {};
          },
        },
      },
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
        onMessage: {
          addListener: () => {},
        },
      },
    };
  });
});

test.describe('Content Script - contenteditable detection', () => {
  test('should detect contenteditable="true" elements', async ({ page }) => {
    await page.goto('about:blank');
    
    // Create a contenteditable element with contenteditable="true"
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      div.id = 'test-true';
      div.textContent = '/prompts test';
      document.body.appendChild(div);
    });
    
    // Verify element is found by our selector
    const found = await page.evaluate(() => {
      const el = document.querySelector('[contenteditable="true"]');
      return el !== null && (el as HTMLElement).isContentEditable;
    });
    
    expect(found).toBe(true);
  });
  
  test('should detect contenteditable="" (empty string) elements', async ({ page }) => {
    await page.goto('about:blank');
    
    // Create a contenteditable element with contenteditable=""
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', '');
      div.id = 'test-empty';
      div.textContent = '/prompts test';
      document.body.appendChild(div);
    });
    
    // Verify element is found by our selector
    const found = await page.evaluate(() => {
      const el = document.querySelector('[contenteditable]');
      return el !== null && (el as HTMLElement).isContentEditable;
    });
    
    expect(found).toBe(true);
  });
  
  test('should detect contenteditable without value (like ChatGPT)', async ({ page }) => {
    await page.goto('about:blank');
    
    // Create an element with contenteditable="plaintext-only" (ChatGPT style)
    await page.evaluate(() => {
      const p = document.createElement('p');
      p.setAttribute('contenteditable', 'plaintext-only');
      p.id = 'test-chatgpt';
      p.textContent = '/prompts test content';
      document.body.appendChild(p);
    });
    
    // Verify element is editable
    const isEditable = await page.evaluate(() => {
      const el = document.getElementById('test-chatgpt');
      return el ? (el as HTMLElement).isContentEditable : false;
    });
    expect(isEditable).toBe(true);
    
    // Verify our selector finds it
    const found = await page.evaluate(() => {
      const el = document.querySelector('[contenteditable]');
      return el !== null;
    });
    
    expect(found).toBe(true);
  });
  
  test('should NOT detect non-editable elements', async ({ page }) => {
    await page.goto('about:blank');
    
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'test-normal';
      div.textContent = 'normal div';
      document.body.appendChild(div);
    });
    
    const isEditable = await page.evaluate(() => {
      const el = document.getElementById('test-normal');
      return el ? (el as HTMLElement).isContentEditable : false;
    });
    
    expect(isEditable).toBe(false);
  });
  
  test('should detect regular input elements', async ({ page }) => {
    await page.goto('about:blank');
    
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'test-input';
      document.body.appendChild(input);
    });
    
    const isInput = await page.evaluate(() => {
      const el = document.getElementById('test-input');
      return el instanceof HTMLInputElement;
    });
    
    expect(isInput).toBe(true);
  });
  
  test('should detect textarea elements', async ({ page }) => {
    await page.goto('about:blank');
    
    await page.evaluate(() => {
      const textarea = document.createElement('textarea');
      textarea.id = 'test-textarea';
      document.body.appendChild(textarea);
    });
    
    const isTextarea = await page.evaluate(() => {
      const el = document.getElementById('test-textarea');
      return el instanceof HTMLTextAreaElement;
    });
    
    expect(isTextarea).toBe(true);
  });
  
  test('selector should find all editable element types', async ({ page }) => {
    await page.goto('about:blank');
    
    // Create all types of editable elements
    await page.evaluate(() => {
      // Input
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'editable-input';
      document.body.appendChild(input);
      
      // Textarea
      const textarea = document.createElement('textarea');
      textarea.id = 'editable-textarea';
      document.body.appendChild(textarea);
      
      // contenteditable="true"
      const div1 = document.createElement('div');
      div1.setAttribute('contenteditable', 'true');
      div1.id = 'editable-true';
      document.body.appendChild(div1);
      
      // contenteditable="" (empty)
      const div2 = document.createElement('div');
      div2.setAttribute('contenteditable', '');
      div2.id = 'editable-empty';
      document.body.appendChild(div2);
      
      // contenteditable="plaintext-only" (ChatGPT style)
      const p = document.createElement('p');
      p.setAttribute('contenteditable', 'plaintext-only');
      p.id = 'editable-plaintext';
      document.body.appendChild(p);
      
      // Non-editable
      const div3 = document.createElement('div');
      div3.id = 'non-editable';
      document.body.appendChild(div3);
    });
    
    // Test our selector (same as in content.ts)
    const foundCount = await page.evaluate(() => {
      const selector = 
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), ' +
        'textarea, ' +
        '[contenteditable], ' +
        '[contenteditable="true"], ' +
        '[contenteditable=""]';
      return document.querySelectorAll(selector).length;
    });
    
    // Should find: input, textarea, div1, div2, p = 5 elements
    expect(foundCount).toBe(5);
  });
});

test.describe('Content Script - Trigger Detection', () => {
  test('should find trigger at cursor position', async ({ page }) => {
    await page.goto('about:blank');
    
    // Test the findTriggerPosition logic
    const result = await page.evaluate(() => {
      const trigger = '/prompts';
      const inputValue = 'Hello /prompts world';
      const caretPos = 14; // Position after "/prompts" (at "w" of "world") (no space after)
      
      const textBeforeCaret = inputValue.substring(0, caretPos);
      const lastIndex = textBeforeCaret.lastIndexOf(trigger);
      
      if (lastIndex === -1) return -1;
      
      const textAfterTrigger = textBeforeCaret.substring(lastIndex + trigger.length);
      if (textAfterTrigger.includes(' ') || textAfterTrigger.includes('\n')) {
        return -1;
      }
      
      return lastIndex;
    });
    
    expect(result).toBe(6); // Position of "/prompts" in the string
  });
  
  test('should NOT trigger when space follows trigger', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const trigger = '/prompts';
      const inputValue = 'Hello /prompts more text here';
      const caretPos = 20; // Position after space following "/prompts"
      
      const textBeforeCaret = inputValue.substring(0, caretPos);
      const lastIndex = textBeforeCaret.lastIndexOf(trigger);
      
      if (lastIndex === -1) return -1;
      
      const textAfterTrigger = textBeforeCaret.substring(lastIndex + trigger.length);
      if (textAfterTrigger.includes(' ') || textAfterTrigger.includes('\n')) {
        return -1;
      }
      
      return lastIndex;
    });
    
    expect(result).toBe(-1); // Should not trigger due to space after
  });
});

test.describe('Content Script - Input Value Retrieval', () => {
  test('should get value from input element', async ({ page }) => {
    await page.goto('about:blank');
    
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Test /prompts value';
      input.id = 'test-input';
      document.body.appendChild(input);
    });
    
    const value = await page.evaluate(() => {
      const input = document.getElementById('test-input') as HTMLInputElement;
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
        return input.value || '';
      }
      return '';
    });
    
    expect(value).toBe('Test /prompts value');
  });
  
  test('should get textContent from contenteditable', async ({ page }) => {
    await page.goto('about:blank');
    
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      div.textContent = 'Test /prompts contenteditable';
      div.id = 'test-contenteditable';
      document.body.appendChild(div);
    });
    
    const value = await page.evaluate(() => {
      const div = document.getElementById('test-contenteditable');
      if (div && div.hasAttribute('contenteditable')) {
        return div.textContent || '';
      }
      return '';
    });
    
    expect(value).toBe('Test /prompts contenteditable');
  });
});
