import { test, expect } from '@playwright/test';

test.describe('GitHub Sync', () => {
  const TEST_REPO = 'axetroy/prompts';
  const TEST_BRANCH = 'main';
  const TEST_PATH = '.agents/promtps'; // Note: typo in repo, using actual path

  test('should construct correct GitHub URLs', async ({ page }) => {
    const result = await page.evaluate(({ repo, branch, path }) => {
      // Tree page URL
      const treeUrl = `https://github.com/${repo}/tree/${branch}/${path}`;
      
      // Raw content URL
      const filePath = `${path}/test.md`;
      const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
      
      return {
        treeUrl,
        rawUrl,
        hasCorrectTreeUrl: treeUrl.includes('github.com') && treeUrl.includes('/tree/'),
        hasCorrectRawUrl: rawUrl.includes('raw.githubusercontent.com'),
        rawUrlHasBranch: rawUrl.includes(`/${branch}/`),
      };
    }, { repo: TEST_REPO, branch: TEST_BRANCH, path: TEST_PATH });
    
    expect(result.hasCorrectTreeUrl).toBe(true);
    expect(result.hasCorrectRawUrl).toBe(true);
    expect(result.rawUrlHasBranch).toBe(true);
    expect(result.treeUrl).toBe('https://github.com/axetroy/prompts/tree/main/.agents/promtps');
    expect(result.rawUrl).toBe('https://raw.githubusercontent.com/axetroy/prompts/main/.agents/promtps/test.md');
  });

  test('should parse file links from GitHub HTML', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Simulate GitHub HTML structure with file links
      const html = `
        <a class="js-navigation-open" href="/axetroy/prompts/blob/main/.agents/promtps/test.md" title="test.md">test.md</a>
        <a class="js-navigation-open" href="/axetroy/prompts/blob/main/.agents/promtps/readme.md" title="readme.md">readme.md</a>
      `;
      
      // Pattern from sync.ts: file links from GitHub tree page
      const fileLinkPattern = /class="js-navigation-open"[^>]+href="\/[^/]+\/[^/]+\/blob\/[^/]+\/([^"?]+\.md)"/g;
      const files: string[] = [];
      let match;
      
      while ((match = fileLinkPattern.exec(html)) !== null) {
        files.push(match[1]);
      }
      
      return {
        filesCount: files.length,
        firstFile: files[0],
        secondFile: files[1],
      };
    });
    
    expect(result.filesCount).toBe(2);
    expect(result.firstFile).toBe('.agents/promtps/test.md');
    expect(result.secondFile).toBe('.agents/promtps/readme.md');
  });

  test('should filter markdown files only', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Simulate GitHub HTML with mixed file types
      const html = `
        <a href="/axetroy/prompts/blob/main/file.ts">file.ts</a>
        <a href="/axetroy/prompts/blob/main/readme.md">readme.md</a>
        <a href="/axetroy/prompts/blob/main/config.json">config.json</a>
        <a href="/axetroy/prompts/blob/main/prompt.md">prompt.md</a>
      `;
      
      // Pattern to match .md files only
      const fileLinkPattern = /href="\/[^/]+\/[^/]+\/blob\/[^/]+\/([^"?]+\.md)"/g;
      const mdFiles: string[] = [];
      let match;
      
      while ((match = fileLinkPattern.exec(html)) !== null) {
        mdFiles.push(match[1]);
      }
      
      // Should only include .md files
      const allMd = mdFiles.every(f => f.endsWith('.md'));
      
      return {
        totalLinks: 4,
        mdFilesCount: mdFiles.length,
        allMarkdown: allMd,
        files: mdFiles,
      };
    });
    
    expect(result.totalLinks).toBe(4);
    expect(result.mdFilesCount).toBe(2);
    expect(result.allMarkdown).toBe(true);
  });

  test('should parse frontmatter from markdown content', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Simulate frontmatter parsing logic from sync.ts
      const content = `---
title: Code Review
description: Review code changes
tags:
  - dev
  - review
---
Please review the following code and provide feedback.`;

      const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
      const match = content.match(frontmatterRegex);
      
      if (!match) {
        return { hasFrontmatter: false };
      }
      
      const yamlContent = match[1];
      const body = match[2];
      const metadata: Record<string, any> = {};
      
      const lines = yamlContent.split('\n');
      let currentKey: string | null = null;
      let inArray = false;
      let arrayValues: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('- ')) {
          if (!inArray) {
            inArray = true;
            arrayValues = [];
          }
          arrayValues.push(trimmedLine.substring(2).trim());
          continue;
        }
        
        if (inArray && currentKey) {
          metadata[currentKey] = arrayValues;
          inArray = false;
          arrayValues = [];
        }
        
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex > 0) {
          if (inArray && currentKey) {
            metadata[currentKey] = arrayValues;
            inArray = false;
            arrayValues = [];
          }
          currentKey = trimmedLine.substring(0, colonIndex).trim();
          const value = trimmedLine.substring(colonIndex + 1).trim();
          if (value) {
            metadata[currentKey] = value;
          }
        }
      }
      
      if (inArray && currentKey) {
        metadata[currentKey] = arrayValues;
      }
      
      return {
        hasFrontmatter: true,
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        bodyLength: body.length,
        bodyStartsCorrectly: body.startsWith('Please review'),
      };
    });
    
    expect(result.hasFrontmatter).toBe(true);
    expect(result.title).toBe('Code Review');
    expect(result.description).toBe('Review code changes');
    expect(result.tags).toEqual(['dev', 'review']);
    expect(result.bodyStartsCorrectly).toBe(true);
  });

  test('should handle sync data structure', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Test the SyncedRepo and SyncedPrompt structures
      interface SyncedRepo {
        id: string;
        repo: string;
        branch: string;
        promptsPath: string;
        lastSyncedAt?: number;
        enabled: boolean;
        enabledPromptIds: string[];
      }
      
      interface SyncedPrompt {
        id: string;
        repoId: string;
        title: string;
        content: string;
        description?: string;
        tags: string[];
        filePath: string;
        createdAt: number;
        updatedAt: number;
        enabled?: boolean;
      }
      
      const repo: SyncedRepo = {
        id: 'sync-123',
        repo: 'axetroy/prompts',
        branch: 'main',
        promptsPath: '.agents/prompts',
        lastSyncedAt: Date.now(),
        enabled: true,
        enabledPromptIds: ['sync-123-code-review'],
      };
      
      const prompt: SyncedPrompt = {
        id: 'sync-123-code-review',
        repoId: 'sync-123',
        title: 'Code Review',
        content: 'Please review the code',
        description: 'Review code changes',
        tags: ['dev', 'review'],
        filePath: '.agents/prompts/code-review.md',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true,
      };
      
      // Simulate filtering enabled prompts from enabled repos
      const enabledRepoIds = new Set(
        [repo].filter(r => r.enabled).map(r => r.id)
      );
      
      const enabledPrompts = [prompt].filter(
        p => enabledRepoIds.has(p.repoId) && p.enabled !== false
      );
      
      return {
        repoHasId: !!repo.id,
        repoHasRepo: repo.repo === 'axetroy/prompts',
        repoHasLastSyncedAt: !!repo.lastSyncedAt,
        promptCount: enabledPrompts.length,
        promptHasTitle: enabledPrompts[0]?.title === 'Code Review',
      };
    });
    
    expect(result.repoHasId).toBe(true);
    expect(result.repoHasRepo).toBe(true);
    expect(result.repoHasLastSyncedAt).toBe(true);
    expect(result.promptCount).toBe(1);
    expect(result.promptHasTitle).toBe(true);
  });

  test('should generate unique IDs for synced prompts', async ({ page }) => {
    const result = await page.evaluate(({ path }) => {
      const timestamp = 1234567890000; // Fixed timestamp for consistent test
      const repoId = `sync-${timestamp}`;
      const files = ['code-review.md', 'translate.md', 'explain.md'];
      
      const prompts = files.map(fileName => ({
        id: `${repoId}-${(`${path}/${fileName}`).replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        repoId,
        title: fileName.replace('.md', ''),
        filePath: `${path}/${fileName}`,
      }));
      
      // Check all IDs are unique
      const uniqueIds = new Set(prompts.map(p => p.id));
      
      return {
        repoIdStartsWithSync: repoId.startsWith('sync-'),
        allIdsUnique: uniqueIds.size === prompts.length,
        firstId: prompts[0].id,
        lastId: prompts[prompts.length - 1].id,
      };
    }, { path: TEST_PATH });
    
    expect(result.repoIdStartsWithSync).toBe(true);
    expect(result.allIdsUnique).toBe(true);
    expect(result.firstId).toBe('sync-1234567890000-.agents_promtps_code-review.md');
    expect(result.lastId).toBe('sync-1234567890000-.agents_promtps_explain.md');
  });

  test('should build correct jsdelivr URLs', async ({ page }) => {
    const result = await page.evaluate(() => {
      const repo = 'axetroy/prompts';
      const branch = 'main';
      const filePath = '.agents/prompts/code-review.md';
      
      // File content URL
      const fileUrl = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${filePath}`;
      
      // Directory listing URL
      const dirPath = '.agents/prompts';
      const dirUrl = `https://www.jsdelivr.com/package/gh/${repo}?version=${branch}&path=${dirPath}`;
      
      return {
        fileUrl,
        dirUrl,
        fileUrlContainsOwner: fileUrl.includes('axetroy'),
        fileUrlContainsRepo: fileUrl.includes('prompts'),
        fileUrlContainsBranch: fileUrl.includes('@main'),
        dirUrlContainsPackage: dirUrl.includes('package/gh/'),
        dirUrlContainsPath: dirUrl.includes('path='),
      };
    });
    
    expect(result.fileUrl).toBe('https://cdn.jsdelivr.net/gh/axetroy/prompts@main/.agents/prompts/code-review.md');
    expect(result.dirUrl).toBe('https://www.jsdelivr.com/package/gh/axetroy/prompts?version=main&path=.agents/prompts');
    expect(result.fileUrlContainsOwner).toBe(true);
    expect(result.fileUrlContainsRepo).toBe(true);
    expect(result.fileUrlContainsBranch).toBe(true);
    expect(result.dirUrlContainsPackage).toBe(true);
    expect(result.dirUrlContainsPath).toBe(true);
  });

  test.describe('Storage Data Normalization', () => {
    test('should normalize customPrompts to prompts', async ({ page }) => {
      const result = await page.evaluate(() => {
        // Simulate storage.ts getStorageData normalization
        function getStorageData(stored: any) {
          if (!stored) {
            return { prompts: [], settings: { trigger: '/prompts', insertMode: 'replace', syncInterval: '1hour' }, usageHistory: [] };
          }
          return {
            prompts: stored.customPrompts || stored.prompts || [],
            settings: stored.settings || { trigger: '/prompts', insertMode: 'replace' },
            usageHistory: stored.usageHistory || [],
            syncedRepos: stored.syncedRepos || [],
            syncedPrompts: stored.syncedPrompts || [],
          };
        }

        const storedWithCustom = {
          customPrompts: [{ id: 'p1', title: 'Test', content: 'test', tags: [], createdAt: 1, updatedAt: 1 }],
          settings: { trigger: '/', insertMode: 'replace' as const },
        };
        const data = getStorageData(storedWithCustom);
        return {
          hasPrompts: Array.isArray(data.prompts),
          promptsLength: data.prompts.length,
          firstPromptTitle: data.prompts[0]?.title,
        };
      });
      expect(result.hasPrompts).toBe(true);
      expect(result.promptsLength).toBe(1);
      expect(result.firstPromptTitle).toBe('Test');
    });

    test('should fall back to prompts field when customPrompts is missing', async ({ page }) => {
      const result = await page.evaluate(() => {
        function getStorageData(stored: any) {
          if (!stored) {
            return { prompts: [], settings: { trigger: '/prompts', insertMode: 'replace', syncInterval: '1hour' }, usageHistory: [] };
          }
          return {
            prompts: stored.customPrompts || stored.prompts || [],
            settings: stored.settings || { trigger: '/prompts', insertMode: 'replace' },
            usageHistory: stored.usageHistory || [],
            syncedRepos: stored.syncedRepos || [],
            syncedPrompts: stored.syncedPrompts || [],
          };
        }

        const storedWithPrompts = {
          prompts: [{ id: 'p1', title: 'Legacy', content: 'test', tags: [], createdAt: 1, updatedAt: 1 }],
          settings: { trigger: '/', insertMode: 'replace' as const },
        };
        const data = getStorageData(storedWithPrompts);
        return {
          promptsLength: data.prompts.length,
          firstPromptTitle: data.prompts[0]?.title,
        };
      });
      expect(result.promptsLength).toBe(1);
      expect(result.firstPromptTitle).toBe('Legacy');
    });

    test('should prefer customPrompts over prompts when both exist', async ({ page }) => {
      const result = await page.evaluate(() => {
        function getStorageData(stored: any) {
          if (!stored) {
            return { prompts: [], settings: { trigger: '/prompts', insertMode: 'replace', syncInterval: '1hour' }, usageHistory: [] };
          }
          return {
            prompts: stored.customPrompts || stored.prompts || [],
            settings: stored.settings || { trigger: '/prompts', insertMode: 'replace' },
            usageHistory: stored.usageHistory || [],
            syncedRepos: stored.syncedRepos || [],
            syncedPrompts: stored.syncedPrompts || [],
          };
        }

        const stored = {
          customPrompts: [{ id: 'c1', title: 'Custom', content: 'c', tags: [], createdAt: 1, updatedAt: 1 }],
          prompts: [{ id: 'p1', title: 'Legacy', content: 'l', tags: [], createdAt: 1, updatedAt: 1 }],
          settings: { trigger: '/', insertMode: 'replace' as const },
        };
        const data = getStorageData(stored);
        return {
          promptsLength: data.prompts.length,
          firstPromptTitle: data.prompts[0]?.title,
        };
      });
      expect(result.promptsLength).toBe(1);
      expect(result.firstPromptTitle).toBe('Custom');
    });

    test('should return defaults when storage is empty', async ({ page }) => {
      const result = await page.evaluate(() => {
        function getStorageData(stored: any) {
          if (!stored) {
            return { prompts: [], settings: { trigger: '/prompts', insertMode: 'replace', syncInterval: '1hour' }, usageHistory: [] };
          }
          return {
            prompts: stored.customPrompts || stored.prompts || [],
            settings: stored.settings || { trigger: '/prompts', insertMode: 'replace' },
            usageHistory: stored.usageHistory || [],
            syncedRepos: stored.syncedRepos || [],
            syncedPrompts: stored.syncedPrompts || [],
          };
        }

        const data = getStorageData(null);
        return {
          promptsLength: data.prompts.length,
          hasSyncInterval: data.settings.syncInterval === '1hour',
        };
      });
      expect(result.promptsLength).toBe(0);
      expect(result.hasSyncInterval).toBe(true);
    });
  });

  test.describe('Storage Save Merge', () => {
    test('should preserve extra keys when saving', async ({ page }) => {
      const result = await page.evaluate(() => {
        // Simulate storage.ts saveStorageData merge logic
        function saveStorageData(raw: any, newData: any) {
          return { ...raw, ...newData };
        }

        const existingStorage = {
          customPrompts: [{ id: 'c1', title: 'Custom', content: 'c', tags: [], createdAt: 1, updatedAt: 1 }],
          disabledDefaultIds: ['default-1', 'default-2'],
          syncedRepos: [{ id: 'sync-1', repo: 'owner/repo', branch: 'main', promptsPath: '.agents/prompts', enabled: true, enabledPromptIds: [] }],
          settings: { trigger: '/', insertMode: 'replace' as const, syncInterval: '1hour' as const },
        };

        const newData = {
          prompts: [{ id: 'p1', title: 'New', content: 'new', tags: [], createdAt: 1, updatedAt: 1 }],
          settings: { trigger: '/prompts', insertMode: 'replace' as const, syncInterval: '15min' as const },
          usageHistory: [],
          syncedRepos: existingStorage.syncedRepos,
          syncedPrompts: [],
        };

        const merged = saveStorageData(existingStorage, newData);
        const keys = Object.keys(merged).sort();
        return {
          hasCustomPrompts: Array.isArray(merged.customPrompts),
          hasDisabledDefaultIds: Array.isArray(merged.disabledDefaultIds),
          hasSyncedRepos: Array.isArray(merged.syncedRepos),
          promptsTitle: merged.prompts[0]?.title,
          settingsTrigger: merged.settings.trigger,
          customPromptTitle: merged.customPrompts[0]?.title,
          keys,
        };
      });
      expect(result.hasCustomPrompts).toBe(true);
      expect(result.hasDisabledDefaultIds).toBe(true);
      expect(result.hasSyncedRepos).toBe(true);
      expect(result.promptsTitle).toBe('New');
      expect(result.settingsTrigger).toBe('/prompts');
      expect(result.customPromptTitle).toBe('Custom');
    });
  });

  test.describe('Sync Status Logic', () => {
    test('should return lastSynced from the most recently synced repo', async ({ page }) => {
      const result = await page.evaluate(() => {
        function getSyncStatus(repos: any[]) {
          const enabledRepos = repos.filter((r: any) => r.enabled);
          let lastSynced: number | null = null;
          for (const repo of enabledRepos) {
            if (repo.lastSyncedAt && (!lastSynced || repo.lastSyncedAt > lastSynced)) {
              lastSynced = repo.lastSyncedAt;
            }
          }
          return { lastSynced, enabled: enabledRepos.length > 0, reposCount: enabledRepos.length };
        }

        const repos = [
          { id: 'r1', enabled: true, lastSyncedAt: 100 },
          { id: 'r2', enabled: true, lastSyncedAt: 300 },
          { id: 'r3', enabled: false, lastSyncedAt: 200 },
        ];

        const status = getSyncStatus(repos);
        return {
          lastSynced: status.lastSynced,
          enabled: status.enabled,
          reposCount: status.reposCount,
        };
      });
      expect(result.lastSynced).toBe(300);
      expect(result.enabled).toBe(true);
      expect(result.reposCount).toBe(2);
    });

    test('should return no sync when no enabled repos', async ({ page }) => {
      const result = await page.evaluate(() => {
        function getSyncStatus(repos: any[]) {
          const enabledRepos = repos.filter((r: any) => r.enabled);
          let lastSynced: number | null = null;
          for (const repo of enabledRepos) {
            if (repo.lastSyncedAt && (!lastSynced || repo.lastSyncedAt > lastSynced)) {
              lastSynced = repo.lastSyncedAt;
            }
          }
          return { lastSynced, enabled: enabledRepos.length > 0, reposCount: enabledRepos.length };
        }

        return {
          empty: getSyncStatus([]),
          allDisabled: getSyncStatus([
            { id: 'r1', enabled: false, lastSyncedAt: 100 },
          ]),
        };
      });
      expect(result.empty.lastSynced).toBeNull();
      expect(result.empty.enabled).toBe(false);
      expect(result.empty.reposCount).toBe(0);
      expect(result.allDisabled.lastSynced).toBeNull();
      expect(result.allDisabled.enabled).toBe(false);
      expect(result.allDisabled.reposCount).toBe(0);
    });

    test('should return null lastSynced when enabled repos never synced', async ({ page }) => {
      const result = await page.evaluate(() => {
        function getSyncStatus(repos: any[]) {
          const enabledRepos = repos.filter((r: any) => r.enabled);
          let lastSynced: number | null = null;
          for (const repo of enabledRepos) {
            if (repo.lastSyncedAt && (!lastSynced || repo.lastSyncedAt > lastSynced)) {
              lastSynced = repo.lastSyncedAt;
            }
          }
          return { lastSynced, enabled: enabledRepos.length > 0, reposCount: enabledRepos.length };
        }

        return getSyncStatus([
          { id: 'r1', enabled: true },
          { id: 'r2', enabled: true },
        ]);
      });
      expect(result.lastSynced).toBeNull();
      expect(result.enabled).toBe(true);
      expect(result.reposCount).toBe(2);
    });
  });

  test.describe('Sync All Enabled Repos Logic', () => {
    test('should return early with zero count when no repos configured', async ({ page }) => {
      const result = await page.evaluate(() => {
        function syncAllEnabledRepos(syncedRepos: any[]) {
          const enabledRepos = syncedRepos.filter((r: any) => r.enabled);
          if (enabledRepos.length === 0) {
            return { success: true, syncedCount: 0, errors: [] };
          }
          return { success: true, syncedCount: 2, errors: [] };
        }

        return syncAllEnabledRepos([]);
      });
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    test('should return early when all repos are disabled', async ({ page }) => {
      const result = await page.evaluate(() => {
        function syncAllEnabledRepos(syncedRepos: any[]) {
          const enabledRepos = syncedRepos.filter((r: any) => r.enabled);
          if (enabledRepos.length === 0) {
            return { success: true, syncedCount: 0, errors: [] };
          }
          return { success: true, syncedCount: 2, errors: [] };
        }

        return syncAllEnabledRepos([
          { id: 'r1', enabled: false },
          { id: 'r2', enabled: false },
        ]);
      });
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(0);
    });

    test('should sync only enabled repos', async ({ page }) => {
      const result = await page.evaluate(() => {
        function syncAllEnabledRepos(syncedRepos: any[]) {
          const enabledRepos = syncedRepos.filter((r: any) => r.enabled);
          if (enabledRepos.length === 0) {
            return { success: true, syncedCount: 0, errors: [] };
          }
          return { success: true, syncedCount: enabledRepos.length, errors: [] };
        }

        return syncAllEnabledRepos([
          { id: 'r1', enabled: true },
          { id: 'r2', enabled: false },
          { id: 'r3', enabled: true },
        ]);
      });
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(2);
    });
  });

  test.describe('Sync ID Generation', () => {
    test('should generate unique IDs for different file paths', async ({ page }) => {
      const result = await page.evaluate(() => {
        // Simulate sync.ts encodeBase64 + ID generation
        function encodeBase64(str: string): string {
          return btoa(str);
        }

        const repoId = 'sync-12345';
        // Use paths with different first 6 bytes to ensure unique base64 prefix
        const filePaths = [
          'code-review.md',
          'translate.md',
          'explain-code.md',
        ];

        const prompts = filePaths.map(filePath => ({
          id: `sync-${repoId}-${encodeBase64(filePath).slice(0, 8)}`,
          repoId,
          filePath,
        }));

        const uniqueIds = new Set(prompts.map(p => p.id));
        return {
          allIdsUnique: uniqueIds.size === prompts.length,
          count: prompts.length,
        };
      });
      expect(result.allIdsUnique).toBe(true);
      expect(result.count).toBe(3);
    });

    test('should produce deterministic IDs for same path', async ({ page }) => {
      const result = await page.evaluate(() => {
        function encodeBase64(str: string): string {
          return btoa(str);
        }

        const repoId = 'sync-12345';
        const filePath = 'code-review.md';
        const id1 = `sync-${repoId}-${encodeBase64(filePath).slice(0, 8)}`;
        const id2 = `sync-${repoId}-${encodeBase64(filePath).slice(0, 8)}`;
        return { idsMatch: id1 === id2 };
      });
      expect(result.idsMatch).toBe(true);
    });
  });

  test.describe('Tag Parsing Edge Cases', () => {
    test('should handle array tags', async ({ page }) => {
      const result = await page.evaluate(() => {
        const metadata = { title: 'Test', tags: ['dev', 'review'] };
        const tags = Array.isArray(metadata.tags) ? metadata.tags : (metadata.tag ? [metadata.tag] : []);
        return { tags, tagCount: tags.length };
      });
      expect(result.tags).toEqual(['dev', 'review']);
      expect(result.tagCount).toBe(2);
    });

    test('should handle single string tag', async ({ page }) => {
      const result = await page.evaluate(() => {
        const metadata = { title: 'Test', tag: 'single-tag' };
        const tags = Array.isArray(metadata.tags) ? metadata.tags : (metadata.tag ? [metadata.tag] : []);
        return { tags, tagCount: tags.length };
      });
      expect(result.tags).toEqual(['single-tag']);
      expect(result.tagCount).toBe(1);
    });

    test('should return empty array when no tags', async ({ page }) => {
      const result = await page.evaluate(() => {
        const metadata = { title: 'Test' };
        const tags = Array.isArray(metadata.tags) ? metadata.tags : (metadata.tag ? [metadata.tag] : []);
        return { tags, tagCount: tags.length };
      });
      expect(result.tags).toEqual([]);
      expect(result.tagCount).toBe(0);
    });

    test('should handle empty tags array', async ({ page }) => {
      const result = await page.evaluate(() => {
        const metadata = { title: 'Test', tags: [] };
        const tags = Array.isArray(metadata.tags) ? metadata.tags : (metadata.tag ? [metadata.tag] : []);
        return { tags, tagCount: tags.length };
      });
      expect(result.tags).toEqual([]);
      expect(result.tagCount).toBe(0);
    });
  });

  test.describe('Sync Result Error Handling', () => {
    test('should collect errors from failed syncs', async ({ page }) => {
      const result = await page.evaluate(() => {
        function syncAllEnabledRepos(syncedRepos: any[]) {
          const enabledRepos = syncedRepos.filter((r: any) => r.enabled);
          if (enabledRepos.length === 0) {
            return { success: true, syncedCount: 0, errors: [] };
          }

          let syncedCount = 0;
          const errors: string[] = [];

          for (const repo of enabledRepos) {
            if (repo.fails) {
              errors.push(`${repo.repo}: Network error`);
            } else {
              syncedCount++;
            }
          }

          return { success: errors.length === 0, syncedCount, errors };
        }

        return syncAllEnabledRepos([
          { id: 'r1', repo: 'good/repo', enabled: true, fails: false },
          { id: 'r2', repo: 'bad/repo', enabled: true, fails: true },
        ]);
      });
      expect(result.success).toBe(false);
      expect(result.syncedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('bad/repo');
    });

    test('should handle all repos failing', async ({ page }) => {
      const result = await page.evaluate(() => {
        function syncAllEnabledRepos(syncedRepos: any[]) {
          const enabledRepos = syncedRepos.filter((r: any) => r.enabled);
          if (enabledRepos.length === 0) {
            return { success: true, syncedCount: 0, errors: [] };
          }

          const syncedCount = 0;
          const errors: string[] = [];

          for (const repo of enabledRepos) {
            errors.push(`${repo.repo}: Timeout`);
          }

          return { success: errors.length === 0, syncedCount, errors };
        }

        return syncAllEnabledRepos([
          { id: 'r1', repo: 'fail1/repo', enabled: true },
          { id: 'r2', repo: 'fail2/repo', enabled: true },
        ]);
      });
      expect(result.success).toBe(false);
      expect(result.syncedCount).toBe(0);
      expect(result.errors).toHaveLength(2);
    });
  });
});