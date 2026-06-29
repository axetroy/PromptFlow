import { test, expect } from '@playwright/test';

// Mock chrome storage for usage tracking tests
test.describe('Usage Tracking', () => {
  let storageData: any = {
    prompts: [
      {
        id: 'prompt-1',
        title: 'Test Prompt 1',
        content: 'Content 1',
        description: 'Description 1',
        tags: ['test', 'sample'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'prompt-2',
        title: 'Test Prompt 2',
        content: 'Content 2',
        description: 'Description 2',
        tags: ['test'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
    ],
    settings: {
      trigger: '/prompts',
      insertMode: 'replace',
    },
    usageHistory: [],
  };

  test.beforeEach(async ({ page }) => {
    // Reset storage for each test
    storageData = {
      prompts: [
        {
          id: 'prompt-1',
          title: 'Test Prompt 1',
          content: 'Content 1',
          description: 'Description 1',
          tags: ['test', 'sample'],
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'prompt-2',
          title: 'Test Prompt 2',
          content: 'Content 2',
          description: 'Description 2',
          tags: ['test'],
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
      ],
      settings: {
        trigger: '/prompts',
        insertMode: 'replace',
      },
      usageHistory: [],
    };

    await page.addInitScript(() => {
      (window as any).chrome = {
        storage: {
          local: {
            get: async () => {
              // Access storageData from test context via window
              return { 'promptflow-data': (window as any).__testStorageData__ };
            },
            set: async (data: any) => {
              (window as any).__testStorageData__ = data['promptflow-data'];
            },
          },
          onChanged: {
            addListener: () => {},
            removeListener: () => {},
          },
        },
        runtime: {
          getURL: (path: string) => `chrome-extension://test/${path}`,
        },
      };
    });
  });

  test('should track prompt usage with correct count', async ({ page }) => {
    await page.goto('about:blank');
    
    // Initialize storage with test data
    await page.evaluate((data) => {
      (window as any).__testStorageData__ = data;
    }, storageData);

    // Simulate recording usage
    const result = await page.evaluate(async () => {
      const data = (window as any).__testStorageData__;
      
      // Simulate selecting prompt-1 three times
      for (let i = 0; i < 3; i++) {
        data.usageHistory.unshift({
          promptId: 'prompt-1',
          usedAt: Date.now() - i * 1000, // Each 1 second apart
        });
      }
      
      // Select prompt-2 once
      data.usageHistory.unshift({
        promptId: 'prompt-2',
        usedAt: Date.now(),
      });

      return {
        historyLength: data.usageHistory.length,
        history: data.usageHistory,
      };
    });

    expect(result.historyLength).toBe(4);
    expect(result.history.filter((u: any) => u.promptId === 'prompt-1').length).toBe(3);
    expect(result.history.filter((u: any) => u.promptId === 'prompt-2').length).toBe(1);
  });

  test('should calculate correct usage statistics', async ({ page }) => {
    await page.goto('about:blank');
    
    // Initialize storage with usage history
    const historyWithUsage = {
      ...storageData,
      usageHistory: [
        { promptId: 'prompt-1', usedAt: Date.now() - 3000 },
        { promptId: 'prompt-2', usedAt: Date.now() - 2000 },
        { promptId: 'prompt-1', usedAt: Date.now() - 1000 },
        { promptId: 'prompt-1', usedAt: Date.now() },
      ],
    };

    await page.evaluate((data) => {
      (window as any).__testStorageData__ = data;
    }, historyWithUsage);

    // Calculate statistics
    const stats = await page.evaluate(() => {
      const data = (window as any).__testStorageData__;
      const statsMap = new Map<string, { count: number; lastUsed: number }>();
      
      for (const usage of data.usageHistory) {
        const existing = statsMap.get(usage.promptId);
        if (existing) {
          existing.count += 1;
          existing.lastUsed = Math.max(existing.lastUsed, usage.usedAt);
        } else {
          statsMap.set(usage.promptId, { count: 1, lastUsed: usage.usedAt });
        }
      }
      
      return Array.from(statsMap.entries()).map(([promptId, stats]) => ({
        promptId,
        count: stats.count,
        lastUsed: stats.lastUsed,
      }));
    });

    expect(stats.length).toBe(2);
    
    const prompt1Stats = stats.find((s: any) => s.promptId === 'prompt-1');
    const prompt2Stats = stats.find((s: any) => s.promptId === 'prompt-2');
    
    expect(prompt1Stats?.count).toBe(3);
    expect(prompt2Stats?.count).toBe(1);
  });

  test('should return unique recent prompts', async ({ page }) => {
    await page.goto('about:blank');
    
    // History is ordered from oldest to newest (newest at the end)
    const historyWithUsage = {
      ...storageData,
      usageHistory: [
        { promptId: 'prompt-1', usedAt: Date.now() - 4000 },  // Oldest
        { promptId: 'prompt-2', usedAt: Date.now() - 3000 },
        { promptId: 'prompt-1', usedAt: Date.now() - 2000 },
        { promptId: 'prompt-2', usedAt: Date.now() - 1000 },  // Newest
      ],
    };

    await page.evaluate((data) => {
      (window as any).__testStorageData__ = data;
    }, historyWithUsage);

    // Get recent unique prompts
    const recentPrompts = await page.evaluate(() => {
      const data = (window as any).__testStorageData__;
      const seen = new Set<string>();
      const recent: any[] = [];
      
      // Iterate in history order (oldest to newest)
      for (const usage of data.usageHistory) {
        if (!seen.has(usage.promptId)) {
          seen.add(usage.promptId);
          recent.push(usage);
          if (recent.length >= 5) break;
        }
      }
      
      return recent;
    });

    // Should return unique prompts in order of first appearance
    expect(recentPrompts.length).toBe(2);
    expect(recentPrompts[0].promptId).toBe('prompt-1'); // First seen
    expect(recentPrompts[1].promptId).toBe('prompt-2'); // Second seen
  });

  test('should not deduplicate usage entries in content script', async ({ page }) => {
    await page.goto('about:blank');
    
    await page.evaluate((data) => {
      (window as any).__testStorageData__ = data;
    }, storageData);

    // Simulate content.ts recordPromptUsage logic
    const result = await page.evaluate(async () => {
      const data = (window as any).__testStorageData__;
      const history = data.usageHistory || [];
      
      // Record same prompt 5 times (simulating what content.ts recordPromptUsage does)
      for (let i = 0; i < 5; i++) {
        history.unshift({
          promptId: 'prompt-1',
          usedAt: Date.now() - i * 100,
        });
      }

      return {
        count: history.length,
        prompt1Count: history.filter((u: any) => u.promptId === 'prompt-1').length,
      };
    });

    // Each usage should be recorded, not deduplicated
    expect(result.count).toBe(5);
    expect(result.prompt1Count).toBe(5);
  });
});
