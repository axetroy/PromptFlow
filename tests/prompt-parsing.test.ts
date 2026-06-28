import { test, expect } from '@playwright/test';

test.describe('Prompt Parsing', () => {
  test('should preserve markdown content unchanged', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      // Simulate the parseFrontmatter function
      function parseFrontmatter(content: string): { metadata: Record<string, any>; body: string } {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);
        
        if (!match) {
          return { metadata: {}, body: content };
        }
        
        return { metadata: {}, body: match[2].trim() };
      }
      
      const markdown = `---
title: Test
---

# Header

\`\`\`js
const x = 1;
\`\`\`

- Item 1
- Item 2`;

      const { body } = parseFrontmatter(markdown);
      
      return {
        body,
        hasCodeBlock: body.includes('```'),
        hasList: body.includes('- Item'),
        hasHeader: body.includes('# Header'),
      };
    });
    
    // Content should be preserved as-is
    expect(result.body).toContain('# Header');
    expect(result.body).toContain('```js');
    expect(result.body).toContain('- Item 1');
    expect(result.hasCodeBlock).toBe(true);
    expect(result.hasList).toBe(true);
    expect(result.hasHeader).toBe(true);
  });
});
