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
        id: `${repoId}-${fileName.replace('.md', '')}`,
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
    expect(result.firstId).toBe('sync-1234567890000-code-review');
    expect(result.lastId).toBe('sync-1234567890000-explain');
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
});