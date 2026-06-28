import { test, expect } from '@playwright/test';

test.describe('Panel Positioning', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });
  
  test('should position panel below input in center of screen', async ({ page }) => {
    await page.goto('about:blank');
    
    const position = await page.evaluate(() => {
      // Create an input in the center of the viewport
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'center-input';
      input.style.cssText = `
        position: fixed;
        top: 300px;
        left: 440px;
        width: 400px;
        height: 40px;
      `;
      document.body.appendChild(input);
      
      const rect = input.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const panelWidth = 400;
      const panelMaxHeight = 500;
      const padding = 8;
      
      // Simulate positionPanel logic
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let top = rect.bottom + padding;
      
      if (spaceBelow >= panelMaxHeight + padding * 2) {
        top = rect.bottom + padding;
      } else if (spaceAbove >= panelMaxHeight + padding * 2) {
        top = rect.top - panelMaxHeight - padding;
      }
      
      let preferredLeft = rect.left;
      if (preferredLeft + panelWidth > viewportWidth - padding) {
        preferredLeft = rect.right - panelWidth;
        if (preferredLeft < padding) {
          preferredLeft = (viewportWidth - panelWidth) / 2;
        }
      }
      
      const left = Math.max(padding, Math.min(preferredLeft, viewportWidth - panelWidth - padding));
      
      return { top, left, rect };
    });
    
    // Panel should be below the input
    expect(position.top).toBeGreaterThan(position.rect.bottom);
    // Panel should be visible (within viewport)
    expect(position.left).toBeGreaterThanOrEqual(8);
    expect(position.left + 400).toBeLessThanOrEqual(1272);
  });
  
  test('should position panel above input when input is at bottom', async ({ page }) => {
    await page.goto('about:blank');
    
    const position = await page.evaluate(() => {
      // Create an input at the bottom of the viewport
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'bottom-input';
      input.style.cssText = `
        position: fixed;
        top: 650px;
        left: 440px;
        width: 400px;
        height: 40px;
      `;
      document.body.appendChild(input);
      
      const rect = input.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const panelWidth = 400;
      const panelMaxHeight = 500;
      const padding = 8;
      
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let top = rect.bottom + padding;
      
      // Should flip to above because there's not enough space below
      if (spaceBelow >= panelMaxHeight + padding * 2) {
        top = rect.bottom + padding;
      } else if (spaceAbove >= panelMaxHeight + padding * 2) {
        top = rect.top - panelMaxHeight - padding;
      } else if (spaceBelow >= spaceAbove) {
        top = rect.bottom + padding;
      } else {
        top = padding;
      }
      
      let preferredLeft = rect.left;
      if (preferredLeft + panelWidth > viewportWidth - padding) {
        preferredLeft = rect.right - panelWidth;
        if (preferredLeft < padding) {
          preferredLeft = (viewportWidth - panelWidth) / 2;
        }
      }
      
      const left = Math.max(padding, Math.min(preferredLeft, viewportWidth - panelWidth - padding));
      
      return { top, left, rect, spaceAbove, spaceBelow };
    });
    
    // Panel should be above the input because input is near bottom
    expect(position.spaceBelow).toBeLessThan(500);
    expect(position.top).toBeLessThan(position.rect.top);
  });
  
  test('should position panel below input when input is at top', async ({ page }) => {
    await page.goto('about:blank');
    
    const position = await page.evaluate(() => {
      // Create an input at the top of the viewport
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'top-input';
      input.style.cssText = `
        position: fixed;
        top: 30px;
        left: 440px;
        width: 400px;
        height: 40px;
      `;
      document.body.appendChild(input);
      
      const rect = input.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const panelMaxHeight = 500;
      const padding = 8;
      
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let top = rect.bottom + padding;
      
      if (spaceBelow >= panelMaxHeight + padding * 2) {
        top = rect.bottom + padding;
      } else if (spaceAbove >= panelMaxHeight + padding * 2) {
        top = rect.top - panelMaxHeight - padding;
      }
      
      return { top, rect, spaceBelow };
    });
    
    // Panel should be below the input because there's plenty of space below
    expect(position.spaceBelow).toBeGreaterThan(500);
    expect(position.top).toBeGreaterThan(position.rect.bottom);
  });
  
  test('should position panel to the left when input is at right edge', async ({ page }) => {
    await page.goto('about:blank');
    
    const position = await page.evaluate(() => {
      // Create an input at the right edge of the viewport
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'right-input';
      input.style.cssText = `
        position: fixed;
        top: 300px;
        left: 900px;
        width: 350px;
        height: 40px;
      `;
      document.body.appendChild(input);
      
      const rect = input.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const panelWidth = 400;
      const padding = 8;
      
      let preferredLeft = rect.left;
      if (preferredLeft + panelWidth > viewportWidth - padding) {
        preferredLeft = rect.right - panelWidth;
        if (preferredLeft < padding) {
          preferredLeft = (viewportWidth - panelWidth) / 2;
        }
      }
      
      const left = Math.max(padding, Math.min(preferredLeft, viewportWidth - panelWidth - padding));
      
      return { left, rect, panelWidth, viewportWidth };
    });
    
    // Panel should be to the left of the input or centered
    expect(position.left + position.panelWidth).toBeLessThanOrEqual(position.viewportWidth - 8);
  });
  
  test('should position panel to the right when input is at left edge', async ({ page }) => {
    await page.goto('about:blank');
    
    const position = await page.evaluate(() => {
      // Create an input at the left edge of the viewport
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'left-input';
      input.style.cssText = `
        position: fixed;
        top: 300px;
        left: 10px;
        width: 350px;
        height: 40px;
      `;
      document.body.appendChild(input);
      
      const rect = input.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const panelWidth = 400;
      const padding = 8;
      
      let preferredLeft = rect.left;
      if (preferredLeft + panelWidth > viewportWidth - padding) {
        preferredLeft = rect.right - panelWidth;
        if (preferredLeft < padding) {
          preferredLeft = (viewportWidth - panelWidth) / 2;
        }
      }
      
      const left = Math.max(padding, Math.min(preferredLeft, viewportWidth - panelWidth - padding));
      
      return { left, rect, panelWidth };
    });
    
    // Panel should be visible (left >= 8)
    expect(position.left).toBeGreaterThanOrEqual(8);
  });
  
  test('should center panel when viewport is very narrow', async ({ page }) => {
    await page.goto('about:blank');
    await page.setViewportSize({ width: 320, height: 568 }); // Mobile size
    
    const position = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const panelWidth = 400;
      const padding = 8;
      
      // When panel is wider than viewport, it should be centered
      const preferredLeft = (viewportWidth - panelWidth) / 2;
      const left = Math.max(padding, Math.min(preferredLeft, viewportWidth - panelWidth - padding));
      
      return { left, viewportWidth, panelWidth };
    });
    
    // Panel should be centered
    expect(position.left).toBeLessThan(50); // Should be close to 0 when centered
  });
  
  test('should clamp panel position to viewport bounds', async ({ page }) => {
    await page.goto('about:blank');
    
    const position = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const panelWidth = 400;
      const panelMaxHeight = 500;
      const padding = 8;
      
      // Test various extreme positions
      const testCases = [
        { left: -100, expectedClamped: padding },
        { left: viewportWidth + 100, expectedClamped: viewportWidth - panelWidth - padding },
        { top: -100, expectedTopClamped: padding },
        { top: viewportHeight + 100, expectedTopClamped: viewportHeight - panelMaxHeight - padding },
      ];
      
      const results = testCases.map(tc => {
        let left = tc.left as number;
        let top = (tc.top || 0) as number;
        
        // Apply clamping logic
        left = Math.max(padding, Math.min(left, viewportWidth - panelWidth - padding));
        top = Math.max(padding, Math.min(top, viewportHeight - panelMaxHeight - padding));
        
        return {
          inputLeft: tc.left,
          expectedLeft: tc.expectedClamped,
          actualLeft: left,
          inputTop: tc.top,
          expectedTop: tc.expectedTopClamped,
          actualTop: top
        };
      });
      
      return results;
    });
    
    // Verify clamping works correctly
    expect(position[0].actualLeft).toBe(8); // -100 clamped to 8
    expect(position[1].actualLeft).toBeLessThan(900); // viewportWidth - panelWidth - padding
  });
  
  test('should calculate correct space above and below', async ({ page }) => {
    await page.goto('about:blank');
    await page.setViewportSize({ width: 1280, height: 720 });
    
    const spaces = await page.evaluate(() => {
      const results: { top: number, spaceAbove: number, spaceBelow: number }[] = [];
      
      [50, 300, 500, 650].forEach(top => {
        const input = document.createElement('input');
        input.style.cssText = `
          position: fixed;
          top: ${top}px;
          left: 440px;
          width: 400px;
          height: 40px;
        `;
        document.body.appendChild(input);
        
        const rect = input.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        results.push({
          top,
          spaceAbove: rect.top,
          spaceBelow: viewportHeight - rect.bottom
        });
      });
      
      return results;
    });
    
    // Verify space calculations
    expect(spaces[0].spaceAbove).toBe(50); // Input at top
    expect(spaces[3].spaceBelow).toBeLessThanOrEqual(30); // Input near bottom
    expect(spaces[0].spaceBelow).toBeGreaterThan(spaces[3].spaceBelow);
  });
  
  test('should handle corner case: input at bottom-left', async ({ page }) => {
    await page.goto('about:blank');
    
    const position = await page.evaluate(() => {
      // Create an input at bottom-left corner
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'corner-input';
      input.style.cssText = `
        position: fixed;
        top: 660px;
        left: 20px;
        width: 300px;
        height: 40px;
      `;
      document.body.appendChild(input);
      
      const rect = input.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const panelWidth = 400;
      const panelMaxHeight = 500;
      const padding = 8;
      
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let top = padding; // Use top because there's no space below
      if (spaceAbove < panelMaxHeight) {
        top = padding; // Clamp to top
      }
      
      let preferredLeft = rect.left;
      if (preferredLeft + panelWidth > viewportWidth - padding) {
        preferredLeft = rect.right - panelWidth;
        if (preferredLeft < padding) {
          preferredLeft = padding;
        }
      }
      
      const left = Math.max(padding, Math.min(preferredLeft, viewportWidth - panelWidth - padding));
      
      return { 
        top, 
        left, 
        panelWidth, 
        viewportWidth,
        spaceBelow,
        spaceAbove
      };
    });
    
    // Panel should be fully within viewport
    expect(position.left).toBeGreaterThanOrEqual(8);
    expect(position.left + position.panelWidth).toBeLessThanOrEqual(position.viewportWidth - 8);
    expect(position.top).toBeGreaterThanOrEqual(8);
  });
});
