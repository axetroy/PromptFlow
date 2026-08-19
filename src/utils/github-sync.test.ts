import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchRepoPrompts } from './github-sync';

const directoryHtml = `
<html>
  <a href="/owner/repo/blob/main/.agents/prompts/my-prompt.md" data-ga-click="File explorer">my-prompt.md</a>
</html>
`;

function mockFetchSequence(contents: string[]) {
  let index = 0;
  return vi.fn(async (_url: string) => {
    if (index === 0) {
      index++;
      return { ok: true, status: 200, text: async () => directoryHtml } as Response;
    }
    return { ok: true, status: 200, text: async () => contents[Math.min(index++ - 1, contents.length - 1)] } as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchRepoPrompts', () => {
  it('should use legacy title frontmatter as name fallback', async () => {
    const content = `---
title: My Legacy Prompt
description: Old format
tags:
- chat
---
Body content`;
    vi.stubGlobal('fetch', mockFetchSequence([content]));

    const prompts = await fetchRepoPrompts('owner/repo', '.agents/prompts', 'main', 'repo-1');
    expect(prompts).toHaveLength(1);
    expect(prompts[0].name).toBe('My Legacy Prompt');
    expect(prompts[0].description).toBe('Old format');
    expect(prompts[0].tags).toEqual(['chat']);
  });

  it('should prefer name frontmatter over legacy title', async () => {
    const content = `---
name: New Name
title: Old Title
---
Body content`;
    vi.stubGlobal('fetch', mockFetchSequence([content]));

    const prompts = await fetchRepoPrompts('owner/repo', '.agents/prompts', 'main', 'repo-1');
    expect(prompts[0].name).toBe('New Name');
  });

  it('should fall back to file name when neither name nor title exists', async () => {
    const content = 'No frontmatter here';
    vi.stubGlobal('fetch', mockFetchSequence([content]));

    const prompts = await fetchRepoPrompts('owner/repo', '.agents/prompts', 'main', 'repo-1');
    expect(prompts[0].name).toBe('my-prompt');
  });
});