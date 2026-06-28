import { test, expect } from '@playwright/test';

test.describe('Prompt Parsing', () => {
  test('should convert inline code to plain text', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      function removeInlineCode(markdown: string): string {
        return markdown.replace(/`([^`]+)`/g, '$1');
      }
      
      return removeInlineCode('Use `console.log()` for debugging');
    });
    
    expect(result).toBe('Use console.log() for debugging');
    expect(result).not.toContain('`');
  });

  test('should convert headers to plain text', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      function removeHeaders(markdown: string): string {
        return markdown.replace(/^#{1,6}\s+/gm, '');
      }
      
      return removeHeaders('# Header 1\n## Header 2\n### Header 3');
    });
    
    expect(result).toBe('Header 1\nHeader 2\nHeader 3');
  });

  test('should convert list items to plain text', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      function removeListPrefixes(markdown: string): string {
        return markdown
          .replace(/^[-*]\s+/gm, '')
          .replace(/^\d+\.\s+/gm, '');
      }
      
      return removeListPrefixes('Focus on:\n- Code quality\n- Performance');
    });
    
    expect(result).toContain('Code quality');
    expect(result).toContain('Performance');
    expect(result).not.toContain('- ');
  });
});
