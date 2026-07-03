import { describe, it, expect } from 'vitest';
import { getAllEnabledPrompts, extractRecentPromptIds } from './prompt-helpers';
import { DEFAULT_PROMPTS, Prompt } from '../types';
import { SyncedRepo, SyncedPrompt } from '../types/sync';

function makePrompt(overrides: Partial<Prompt> & { id: string }): Prompt {
  return {
    title: 'Test',
    content: 'content',
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('getAllEnabledPrompts', () => {
  it('should return only default prompts when custom list is empty', () => {
    const result = getAllEnabledPrompts([], [], [], []);
    const ids = result.map(p => p.id);
    const defaultIds = DEFAULT_PROMPTS.map(p => p.id);
    expect(ids).toEqual(expect.arrayContaining(defaultIds));
    expect(result.length).toBe(DEFAULT_PROMPTS.length);
  });

  it('should include custom prompts alongside defaults', () => {
    const custom = makePrompt({ id: 'custom-1', title: 'My Custom' });
    const result = getAllEnabledPrompts([custom], [], [], []);
    expect(result.length).toBe(DEFAULT_PROMPTS.length + 1);
    expect(result.find(p => p.id === 'custom-1')).toBeDefined();
  });

  it('should exclude disabled custom prompts', () => {
    const custom = makePrompt({ id: 'custom-1', enabled: false });
    const result = getAllEnabledPrompts([custom], [], [], []);
    expect(result.length).toBe(DEFAULT_PROMPTS.length);
    expect(result.find(p => p.id === 'custom-1')).toBeUndefined();
  });

  it('should exclude disabled default prompts', () => {
    const disabledIds = [DEFAULT_PROMPTS[0].id];
    const result = getAllEnabledPrompts([], disabledIds, [], []);
    expect(result.length).toBe(DEFAULT_PROMPTS.length - 1);
    expect(result.find(p => p.id === DEFAULT_PROMPTS[0].id)).toBeUndefined();
  });

  it('should include synced prompts from enabled repos', () => {
    const repo: SyncedRepo = {
      id: 'repo-1',
      repo: 'owner/repo',
      branch: 'main',
      promptsPath: '.agents/prompts',
      enabled: true,
      enabledPromptIds: [],
    };
    const synced: SyncedPrompt = {
      id: 'synced-1',
      repoId: 'repo-1',
      title: 'Synced Prompt',
      content: 'synced content',
      tags: [],
      filePath: 'test.md',
      createdAt: 0,
      updatedAt: 0,
    };
    const result = getAllEnabledPrompts([], [], [repo], [synced]);
    expect(result.length).toBe(DEFAULT_PROMPTS.length + 1);
    expect(result.find(p => p.id === 'synced-1')).toBeDefined();
  });

  it('should exclude synced prompts from disabled repos', () => {
    const repo: SyncedRepo = {
      id: 'repo-1',
      repo: 'owner/repo',
      branch: 'main',
      promptsPath: '.agents/prompts',
      enabled: false,
      enabledPromptIds: [],
    };
    const synced: SyncedPrompt = {
      id: 'synced-1',
      repoId: 'repo-1',
      title: 'Synced Prompt',
      content: 'synced content',
      tags: [],
      filePath: 'test.md',
      createdAt: 0,
      updatedAt: 0,
    };
    const result = getAllEnabledPrompts([], [], [repo], [synced]);
    expect(result.length).toBe(DEFAULT_PROMPTS.length);
  });

});

describe('extractRecentPromptIds', () => {
  it('should return unique prompt IDs in order', () => {
    const history = [
      { promptId: 'a' },
      { promptId: 'b' },
      { promptId: 'a' },
      { promptId: 'c' },
    ];
    expect(extractRecentPromptIds(history, 5)).toEqual(['a', 'b', 'c']);
  });

  it('should respect the limit', () => {
    const history = [
      { promptId: 'a' },
      { promptId: 'b' },
      { promptId: 'c' },
    ];
    expect(extractRecentPromptIds(history, 2)).toEqual(['a', 'b']);
  });

  it('should return empty array for empty history', () => {
    expect(extractRecentPromptIds([], 5)).toEqual([]);
  });
});
