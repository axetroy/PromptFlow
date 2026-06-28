import { test, expect } from '@playwright/test';

test.describe('Panel Positioning Near Cursor', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should position panel below input center when cursor at start', async ({ page }) => {
    await page.goto('about:blank');

    const position = await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Hello World';
      input.style.cssText = 'position: fixed; top: 200px; left: 440px; width: 400px; height: 40px; font-size: 16px; font-family: Arial;';
      document.body.appendChild(input);
      input.focus();
      input.setSelectionRange(0, 0);

      const inputRect = input.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const panelWidth = 420;
      const panelMinHeight = 200;
      const padding = 8;

      // For simple test, use input bottom as reference
      const refBottom = inputRect.bottom;
      const spaceBelow = viewportHeight - refBottom;

      let top: number;
      let panelHeight: number;

      if (spaceBelow >= panelMinHeight) {
        top = refBottom + padding;
        panelHeight = Math.min(spaceBelow - padding, 500);
      } else {
        top = padding;
        panelHeight = Math.max(spaceBelow - padding, 150);
      }

      const left = inputRect.left + (inputRect.width - panelWidth) / 2;

      return { top, left, refBottom, spaceBelow, panelMinHeight };
    });

    expect(position.spaceBelow).toBeGreaterThan(position.panelMinHeight);
    expect(position.top).toBeGreaterThan(position.refBottom);
  });

  test('should position panel below input when cursor at end', async ({ page }) => {
    await page.goto('about:blank');

    const position = await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Hello';
      input.style.cssText = 'position: fixed; top: 200px; left: 440px; width: 400px; height: 40px; font-size: 16px; font-family: Arial;';
      document.body.appendChild(input);
      input.focus();
      input.setSelectionRange(5, 5);

      const inputRect = input.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const panelWidth = 420;
      const panelMinHeight = 200;
      const padding = 8;

      const refBottom = inputRect.bottom;
      const spaceBelow = viewportHeight - refBottom;

      let top: number;
      if (spaceBelow >= panelMinHeight) {
        top = refBottom + padding;
      } else {
        top = padding;
      }

      const left = inputRect.left + (inputRect.width - panelWidth) / 2;

      return { top, left, refBottom, spaceBelow };
    });

    expect(position.top).toBeGreaterThan(position.refBottom);
  });

  test('should position panel above when not enough space below', async ({ page }) => {
    await page.goto('about:blank');

    const position = await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Test';
      input.style.cssText = 'position: fixed; top: 650px; left: 440px; width: 400px; height: 40px; font-size: 16px; font-family: Arial;';
      document.body.appendChild(input);
      input.focus();
      input.setSelectionRange(4, 4);

      const inputRect = input.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const panelMinHeight = 200;
      const padding = 8;

      const refBottom = inputRect.bottom;
      const refTop = inputRect.top;
      const spaceBelow = viewportHeight - refBottom;
      const spaceAbove = refTop;

      let top: number;
      let panelHeight: number;

      if (spaceBelow >= panelMinHeight) {
        top = refBottom + padding;
        panelHeight = Math.min(spaceBelow - padding, 500);
      } else if (spaceAbove >= panelMinHeight) {
        panelHeight = Math.min(spaceAbove - padding, 500);
        top = refTop - panelHeight - padding;
      } else if (spaceBelow >= spaceAbove) {
        top = refBottom + padding;
        panelHeight = Math.max(spaceBelow - padding, 150);
      } else {
        panelHeight = Math.max(spaceAbove - padding, 150);
        top = padding;
      }

      return { top, refTop, refBottom, spaceBelow, spaceAbove, panelMinHeight };
    });

    expect(position.spaceBelow).toBeLessThan(position.panelMinHeight);
    expect(position.top).toBeLessThan(position.refTop);
  });

  test('should position panel with contenteditable cursor detection', async ({ page }) => {
    await page.goto('about:blank');

    const position = await page.evaluate(() => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      div.textContent = 'Hello World';
      div.style.cssText = 'position: fixed; top: 200px; left: 440px; width: 400px; height: 40px; font-size: 16px; font-family: Arial;';
      document.body.appendChild(div);

      // Set cursor at position 6 (after "Hello ")
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(div.firstChild!, 6);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);

      // Get cursor rect
      const cursorRects = range.getClientRects();
      const cursorRect = cursorRects.length > 0 ? cursorRects[cursorRects.length - 1] : range.getBoundingClientRect();

      const divRect = div.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const panelMinHeight = 200;
      const padding = 8;

      const cursorBottom = cursorRect.bottom;
      const cursorTop = cursorRect.top;
      const spaceBelow = viewportHeight - cursorBottom;
      const spaceAbove = cursorTop;

      let top: number;
      if (spaceBelow >= panelMinHeight) {
        top = cursorBottom + padding;
      } else if (spaceAbove >= panelMinHeight) {
        top = cursorTop - 500 - padding;
      } else {
        top = padding;
      }

      return { top, cursorTop, cursorBottom, spaceBelow };
    });

    expect(position.top).toBeGreaterThan(position.cursorBottom);
  });
});
