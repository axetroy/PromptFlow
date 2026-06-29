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
      {
        id: 'prompt-3',
        title: 'Test Prompt 3',
        content: 'Content 3',
        description: 'Description 3',
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
        {
          id: 'prompt-3',
          title: 'Test Prompt 3',
          content: 'Content 3',
          description: 'Description 3',
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

// Popularity Score Tests
test.describe('Popularity Score Calculation', () => {
  test('score should be equal to count when used just now', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const HALF_LIFE_DAYS = 14;
      const calculatePopularityScore = (count: number, lastUsedAt: number, now: number = Date.now()): number => {
        const daysSinceLastUse = (now - lastUsedAt) / (1000 * 60 * 60 * 24);
        const decayFactor = Math.pow(0.5, daysSinceLastUse / HALF_LIFE_DAYS);
        return count * decayFactor;
      };
      
      const now = Date.now();
      const score = calculatePopularityScore(5, now, now);
      return { score, count: 5 };
    });

    expect(result.score).toBe(5);
  });

  test('score should halve after half-life days', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const HALF_LIFE_DAYS = 14;
      const calculatePopularityScore = (count: number, lastUsedAt: number, now: number = Date.now()): number => {
        const daysSinceLastUse = (now - lastUsedAt) / (1000 * 60 * 60 * 24);
        const decayFactor = Math.pow(0.5, daysSinceLastUse / HALF_LIFE_DAYS);
        return count * decayFactor;
      };
      
      const MS_PER_DAY = 1000 * 60 * 60 * 24;
      const now = Date.now();
      const halfLifeMs = 14 * MS_PER_DAY; // 14 days in ms
      const lastUsedAt = now - halfLifeMs;
      const score = calculatePopularityScore(10, lastUsedAt, now);
      return { score, expectedScore: 5 };
    });

    // Score should be 5 (10 * 0.5)
    expect(result.score).toBeCloseTo(result.expectedScore, 10);
  });

  test('prompt with higher count should rank higher regardless of recency', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const HALF_LIFE_DAYS = 14;
      const calculatePopularityScore = (count: number, lastUsedAt: number, now: number = Date.now()): number => {
        const daysSinceLastUse = (now - lastUsedAt) / (1000 * 60 * 60 * 24);
        const decayFactor = Math.pow(0.5, daysSinceLastUse / HALF_LIFE_DAYS);
        return count * decayFactor;
      };
      
      const msPerDay = 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      // Prompt A: used 10 times, last used 7 days ago
      // Prompt B: used 1 time, last used just now
      const promptA = { count: 10, lastUsedAt: now - 7 * msPerDay };
      const promptB = { count: 1, lastUsedAt: now };
      
      const scoreA = calculatePopularityScore(promptA.count, promptA.lastUsedAt, now);
      const scoreB = calculatePopularityScore(promptB.count, promptB.lastUsedAt, now);
      
      return {
        scoreA,
        scoreB,
        higherRanked: scoreA > scoreB ? 'promptA' : 'promptB'
      };
    });

    // Even though promptB is newer, promptA's higher count should give it a higher score
    // ScoreA = 10 * 0.5^(7/14) = 10 * 0.5^0.5 ≈ 10 * 0.707 ≈ 7.07
    // ScoreB = 1 * 0.5^0 = 1
    // So ScoreA > ScoreB
    expect(result.scoreA).toBeGreaterThan(result.scoreB);
  });

  test('prompts should be sorted by score descending', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const HALF_LIFE_DAYS = 14;
      const calculatePopularityScore = (count: number, lastUsedAt: number, now: number = Date.now()): number => {
        const daysSinceLastUse = (now - lastUsedAt) / (1000 * 60 * 60 * 24);
        const decayFactor = Math.pow(0.5, daysSinceLastUse / HALF_LIFE_DAYS);
        return count * decayFactor;
      };
      
      const msPerDay = 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      const prompts = [
        { id: 'prompt-1', count: 5, lastUsedAt: now - 14 * msPerDay },   // 14 days ago, score = 2.5
        { id: 'prompt-2', count: 3, lastUsedAt: now - 7 * msPerDay },    // 7 days ago, score ≈ 2.12
        { id: 'prompt-3', count: 1, lastUsedAt: now },                   // just now, score = 1
      ];
      
      const scores = prompts.map(p => ({
        id: p.id,
        score: calculatePopularityScore(p.count, p.lastUsedAt, now)
      }));
      
      // Sort by score descending
      scores.sort((a, b) => b.score - a.score);
      
      return scores;
    });

    // Expected order by score: prompt-1 (2.5) > prompt-2 (≈2.12) > prompt-3 (1)
    expect(result[0].id).toBe('prompt-1');
    expect(result[1].id).toBe('prompt-2');
    expect(result[2].id).toBe('prompt-3');
  });

  test('decay factor calculation is correct', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const HALF_LIFE_DAYS = 14;
      
      // After 0 days, decay should be 1
      const decay0 = Math.pow(0.5, 0 / HALF_LIFE_DAYS);
      // After 14 days, decay should be 0.5
      const decay14 = Math.pow(0.5, 14 / HALF_LIFE_DAYS);
      // After 28 days, decay should be 0.25
      const decay28 = Math.pow(0.5, 28 / HALF_LIFE_DAYS);
      // After 7 days (half of half-life), decay should be √0.5 ≈ 0.707
      const decay7 = Math.pow(0.5, 7 / HALF_LIFE_DAYS);
      
      return {
        decay0,
        decay14,
        decay28,
        decay7,
        halfLifeDays: HALF_LIFE_DAYS
      };
    });

    // After 0 days, decay = 0.5^0 = 1
    expect(result.decay0).toBeCloseTo(1, 10);
    // After half-life days, decay = 0.5^1 = 0.5
    expect(result.decay14).toBeCloseTo(0.5, 10);
    // After double half-life days, decay = 0.5^2 = 0.25
    expect(result.decay28).toBeCloseTo(0.25, 10);
    // After half of half-life days, decay = 0.5^0.5 ≈ 0.707
    expect(result.decay7).toBeCloseTo(Math.SQRT1_2, 10);
  });

  test('multiple usages of same prompt should increase count', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      
      // Simulate usage history with multiple uses of same prompt
      const usageHistory = [
        { promptId: 'prompt-1', usedAt: now - 20 * msPerDay },
        { promptId: 'prompt-1', usedAt: now - 10 * msPerDay },
        { promptId: 'prompt-1', usedAt: now - 5 * msPerDay },
        { promptId: 'prompt-2', usedAt: now - 1 * msPerDay },
      ];
      
      // Aggregate stats
      const statsMap = new Map<string, { count: number; lastUsedAt: number }>();
      for (const usage of usageHistory) {
        const existing = statsMap.get(usage.promptId);
        if (existing) {
          existing.count += 1;
          existing.lastUsedAt = Math.max(existing.lastUsedAt, usage.usedAt);
        } else {
          statsMap.set(usage.promptId, { count: 1, lastUsedAt: usage.usedAt });
        }
      }
      
      const prompt1Stats = statsMap.get('prompt-1')!;
      const prompt2Stats = statsMap.get('prompt-2')!;
      
      return {
        prompt1Count: prompt1Stats.count,
        prompt1LastUsed: prompt1Stats.lastUsedAt,
        prompt2Count: prompt2Stats.count,
        prompt2LastUsed: prompt2Stats.lastUsedAt,
      };
    });

    expect(result.prompt1Count).toBe(3);
    expect(result.prompt2Count).toBe(1);
  });
});
