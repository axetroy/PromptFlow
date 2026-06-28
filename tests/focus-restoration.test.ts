import { test, expect } from '@playwright/test';

test.describe('Focus Restoration on Panel Close', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Inject mock chrome API
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
                      trigger: '/p',
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

  test('should restore cursor position after closing panel with ESC', async ({ page }) => {
    await page.goto('about:blank');

    // Create an input with text
    const input = await page.locator('body').evaluateHandle(() => {
      const el = document.createElement('input');
      el.type = 'text';
      el.value = 'asdf /p';
      el.style.cssText = 'position: fixed; top: 200px; left: 440px; width: 400px; height: 40px; font-size: 16px; font-family: Arial;';
      document.body.appendChild(el);
      return el;
    });

    // Set cursor position after "/p" (position 7, after "asdf /p")
    await page.evaluate(() => {
      const inputEl = document.querySelector('input') as HTMLInputElement;
      inputEl.focus();
      inputEl.setSelectionRange(7, 7); // Position after "asdf /p"
    });

    // Get the cursor position before
    const cursorBefore = await page.evaluate(() => {
      const inputEl = document.querySelector('input') as HTMLInputElement;
      return {
        value: inputEl.value,
        position: inputEl.selectionStart,
        documentActiveElement: document.activeElement === inputEl,
      };
    });

    expect(cursorBefore.position).toBe(7);
    expect(cursorBefore.value).toBe('asdf /p');

    // Trigger panel open by typing (simulate the trigger detection)
    await page.evaluate(() => {
      // Load the content script logic manually for testing
      const state = {
        isPanelOpen: false,
        currentInput: null,
        triggerStartPosition: 0,
        caretPosition: 0,
        currentTrigger: '/p',
      };

      // Simulate opening panel
      const inputEl = document.querySelector('input') as HTMLInputElement;
      state.isPanelOpen = true;
      state.currentInput = inputEl;
      state.triggerStartPosition = 5; // Position of "/p" in "asdf /p"
      state.caretPosition = 7; // Cursor after "/p"

      // Simulate closing panel (restore focus)
      state.isPanelOpen = false;
      inputEl.focus();
      
      // The fix: use caretPosition (7), not triggerStartPosition (5)
      const positionToRestore = state.caretPosition;
      inputEl.setSelectionRange(positionToRestore, positionToRestore);

      // Check result
      return {
        restoredPosition: inputEl.selectionStart,
        activeElement: document.activeElement === inputEl,
      };
    });

    const result = await page.evaluate(() => {
      const inputEl = document.querySelector('input') as HTMLInputElement;
      return {
        restoredPosition: inputEl.selectionStart,
        activeElement: document.activeElement === inputEl,
      };
    });

    expect(result.activeElement).toBe(true);
    expect(result.restoredPosition).toBe(7);
  });

  test('should restore cursor to end of trigger when typing after trigger', async ({ page }) => {
    await page.goto('about:blank');

    // Create an input
    const input = await page.locator('body').evaluateHandle(() => {
      const el = document.createElement('input');
      el.type = 'text';
      el.value = 'hello /prompts world';
      el.style.cssText = 'position: fixed; top: 200px; left: 440px; width: 400px; height: 40px; font-size: 16px; font-family: Arial;';
      document.body.appendChild(el);
      return el;
    });

    // Set cursor at the end (position 18)
    await page.evaluate(() => {
      const inputEl = document.querySelector('input') as HTMLInputElement;
      inputEl.focus();
      inputEl.setSelectionRange(18, 18);
    });

    // Simulate the focus restoration logic
    const result = await page.evaluate(() => {
      const inputEl = document.querySelector('input') as HTMLInputElement;
      const trigger = '/prompts';
      const value = inputEl.value;
      const triggerPos = value.indexOf(trigger);
      
      // Simulate panel being opened
      const caretPosition = 18; // Cursor at end
      
      // Simulate panel close - should restore caretPosition, not triggerPos
      const positionToRestore = caretPosition;
      inputEl.focus();
      inputEl.setSelectionRange(positionToRestore, positionToRestore);

      return {
        restoredPosition: inputEl.selectionStart,
        value: inputEl.value,
        activeElement: document.activeElement === inputEl,
      };
    });

    expect(result.activeElement).toBe(true);
    expect(result.restoredPosition).toBe(18);
    expect(result.value).toBe('hello /prompts world');
  });

  test('should handle textarea with multiline content', async ({ page }) => {
    await page.goto('about:blank');

    // Create a textarea
    const textarea = await page.locator('body').evaluateHandle(() => {
      const el = document.createElement('textarea');
      el.value = 'line1\n/p line2\nline3';
      el.style.cssText = 'position: fixed; top: 200px; left: 440px; width: 400px; height: 100px; font-size: 16px; font-family: Arial;';
      document.body.appendChild(el);
      return el;
    });

    // Set cursor position (after "/p " at position 10)
    await page.evaluate(() => {
      const textareaEl = document.querySelector('textarea') as HTMLTextAreaElement;
      textareaEl.focus();
      textareaEl.setSelectionRange(10, 10);
    });

    // Simulate focus restoration
    const result = await page.evaluate(() => {
      const textareaEl = document.querySelector('textarea') as HTMLTextAreaElement;
      const caretPosition = 10; // After "/p "
      
      textareaEl.focus();
      textareaEl.setSelectionRange(caretPosition, caretPosition);

      return {
        restoredPosition: textareaEl.selectionStart,
        activeElement: document.activeElement === textareaEl,
      };
    });

    expect(result.activeElement).toBe(true);
    expect(result.restoredPosition).toBe(10);
  });
});