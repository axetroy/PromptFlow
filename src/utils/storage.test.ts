import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStorageData,
  saveStorageData,
  getPrompts,
  savePrompts,
  getSettings,
  saveSettings,
  addPrompt,
  updatePrompt,
  deletePrompt,
  getUsageHistory,
  recordPromptUsage,
  getUsageStats,
  getRecentPrompts,
  clearUsageHistory,
} from './storage';
import { Prompt, StorageData, DEFAULT_SETTINGS } from '../types';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};

const chromeStorageMock = {
  get: vi.fn((keys: string[], callback: (result: Record<string, unknown>) => void) => {
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (mockStorage[key] !== undefined) {
        result[key] = mockStorage[key];
      }
    }
    callback(result);
  }),
  set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
    Object.assign(mockStorage, items);
    if (callback) callback();
  }),
};

// Set up chrome global before imports use it
const globalObj = globalThis as Record<string, unknown>;
globalObj.chrome = {
  storage: {
    local: chromeStorageMock,
  },
};

function clearMockStorage() {
  for (const key of Object.keys(mockStorage)) {
    delete mockStorage[key];
  }
  vi.clearAllMocks();
}

function createTestPrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'test-1',
    title: 'Test Prompt',
    content: 'Test content',
    description: 'Test description',
    tags: ['test'],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('getStorageData', () => {
  beforeEach(clearMockStorage);

  it('should return default data when storage is empty', async () => {
    const data = await getStorageData();
    expect(data.settings).toEqual(DEFAULT_SETTINGS);
    expect(Array.isArray(data.prompts)).toBe(true);
    expect(data.usageHistory).toEqual([]);
  });

  it('should return stored data when available', async () => {
    const stored: StorageData = {
      prompts: [createTestPrompt()],
      settings: { trigger: '/test', insertMode: 'append' },
      usageHistory: [{ promptId: 'test-1', usedAt: 1000 }],
    };
    mockStorage['promptflow-data'] = stored;

    const data = await getStorageData();
    expect(data.prompts).toEqual([createTestPrompt()]);
    expect(data.settings.trigger).toBe('/test');
    expect(data.usageHistory).toHaveLength(1);
  });

  it('should migrate customPrompts to prompts', async () => {
    mockStorage['promptflow-data'] = {
      customPrompts: [createTestPrompt({ id: 'custom-1' })],
      settings: DEFAULT_SETTINGS,
    };

    const data = await getStorageData();
    expect(data.prompts).toEqual([createTestPrompt({ id: 'custom-1' })]);
  });

  it('should default missing fields', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [],
    };

    const data = await getStorageData();
    expect(data.settings).toEqual(DEFAULT_SETTINGS);
    expect(data.usageHistory).toEqual([]);
    expect(data.syncedRepos).toEqual([]);
    expect(data.syncedPrompts).toEqual([]);
  });
});

describe('saveStorageData', () => {
  beforeEach(clearMockStorage);

  it('should save data to storage', async () => {
    const data: StorageData = {
      prompts: [createTestPrompt()],
      settings: DEFAULT_SETTINGS,
      usageHistory: [],
    };

    await saveStorageData(data);
    expect(chromeStorageMock.set).toHaveBeenCalled();
    expect(mockStorage['promptflow-data']).toBeDefined();
  });

  it('should merge with existing data', async () => {
    mockStorage['promptflow-data'] = {
      existingField: 'preserved',
      prompts: [],
    };

    const data: StorageData = {
      prompts: [createTestPrompt()],
      settings: DEFAULT_SETTINGS,
      usageHistory: [],
    };

    await saveStorageData(data);
    const saved = mockStorage['promptflow-data'] as Record<string, unknown>;
    expect(saved.existingField).toBe('preserved');
    expect((saved.prompts as Prompt[]).length).toBe(1);
  });
});

describe('getPrompts', () => {
  beforeEach(clearMockStorage);

  it('should return prompts from storage', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [createTestPrompt()],
      settings: DEFAULT_SETTINGS,
    };

    const prompts = await getPrompts();
    expect(prompts).toEqual([createTestPrompt()]);
  });

  it('should return default prompts when storage is empty', async () => {
    const prompts = await getPrompts();
    expect(prompts.length).toBeGreaterThan(0);
  });
});

describe('savePrompts', () => {
  beforeEach(clearMockStorage);

  it('should save prompts to storage', async () => {
    const prompts = [createTestPrompt()];
    await savePrompts(prompts);

    const data = await getStorageData();
    expect(data.prompts).toEqual(prompts);
  });
});

describe('getSettings / saveSettings', () => {
  beforeEach(clearMockStorage);

  it('should return default settings when storage is empty', async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('should save and retrieve settings', async () => {
    const newSettings = { trigger: '/cmd', insertMode: 'append' as const };
    await saveSettings(newSettings);

    const settings = await getSettings();
    expect(settings.trigger).toBe('/cmd');
    expect(settings.insertMode).toBe('append');
  });
});

describe('addPrompt', () => {
  beforeEach(clearMockStorage);

  it('should add a prompt to storage', async () => {
    const prompt = createTestPrompt({ id: 'new-1' });
    await addPrompt(prompt);

    const prompts = await getPrompts();
    const found = prompts.find(p => p.id === 'new-1');
    expect(found).toBeDefined();
  });
});

describe('updatePrompt', () => {
  beforeEach(clearMockStorage);

  it('should update an existing prompt', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [createTestPrompt({ id: 'update-1', title: 'Old Title' })],
      settings: DEFAULT_SETTINGS,
    };

    await updatePrompt('update-1', { title: 'New Title' });

    const prompts = await getPrompts();
    const updated = prompts.find(p => p.id === 'update-1');
    expect(updated!.title).toBe('New Title');
    expect(updated!.updatedAt).toBeGreaterThan(0);
  });

  it('should not modify prompts when ID is not found', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [createTestPrompt({ id: 'existing' })],
      settings: DEFAULT_SETTINGS,
    };

    await updatePrompt('nonexistent', { title: 'Updated' });

    const prompts = await getPrompts();
    expect(prompts).toHaveLength(1);
    expect(prompts[0].title).toBe('Test Prompt');
  });
});

describe('deletePrompt', () => {
  beforeEach(clearMockStorage);

  it('should delete a prompt by ID', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [
        createTestPrompt({ id: 'keep' }),
        createTestPrompt({ id: 'delete-me' }),
      ],
      settings: DEFAULT_SETTINGS,
    };

    await deletePrompt('delete-me');

    const prompts = await getPrompts();
    expect(prompts).toHaveLength(1);
    expect(prompts[0].id).toBe('keep');
  });
});

describe('getUsageHistory', () => {
  beforeEach(clearMockStorage);

  it('should return empty array when no history', async () => {
    const history = await getUsageHistory();
    expect(history).toEqual([]);
  });

  it('should return usage history from storage', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [],
      settings: DEFAULT_SETTINGS,
      usageHistory: [
        { promptId: 'p1', usedAt: 1000 },
        { promptId: 'p2', usedAt: 2000 },
      ],
    };

    const history = await getUsageHistory();
    expect(history).toHaveLength(2);
  });
});

describe('recordPromptUsage', () => {
  beforeEach(clearMockStorage);

  it('should add usage record at the beginning', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [],
      settings: DEFAULT_SETTINGS,
      usageHistory: [{ promptId: 'old', usedAt: 1000 }],
    };

    await recordPromptUsage('new-prompt');

    const history = await getUsageHistory();
    expect(history[0].promptId).toBe('new-prompt');
    expect(history[1].promptId).toBe('old');
  });

  it('should initialize usageHistory if not exists', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [],
      settings: DEFAULT_SETTINGS,
    };

    await recordPromptUsage('first-usage');

    const history = await getUsageHistory();
    expect(history).toHaveLength(1);
    expect(history[0].promptId).toBe('first-usage');
  });

  it('should trim history to MAX_USAGE_HISTORY', async () => {
    const largeHistory = Array.from({ length: 100 }, (_, i) => ({
      promptId: `p-${i}`,
      usedAt: i,
    }));
    mockStorage['promptflow-data'] = {
      prompts: [],
      settings: DEFAULT_SETTINGS,
      usageHistory: largeHistory,
    };

    await recordPromptUsage('overflow');

    const history = await getUsageHistory();
    expect(history.length).toBeLessThanOrEqual(100);
    expect(history[0].promptId).toBe('overflow');
  });
});

describe('getUsageStats', () => {
  beforeEach(clearMockStorage);

  it('should return empty map when no history', async () => {
    const stats = await getUsageStats();
    expect(stats.size).toBe(0);
  });

  it('should count usage per prompt', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [],
      settings: DEFAULT_SETTINGS,
      usageHistory: [
        { promptId: 'p1', usedAt: 1000 },
        { promptId: 'p2', usedAt: 2000 },
        { promptId: 'p1', usedAt: 3000 },
        { promptId: 'p1', usedAt: 4000 },
      ],
    };

    const stats = await getUsageStats();
    expect(stats.get('p1')).toBe(3);
    expect(stats.get('p2')).toBe(1);
  });
});

describe('getRecentPrompts', () => {
  beforeEach(clearMockStorage);

  it('should return empty array when no history', async () => {
    const recent = await getRecentPrompts();
    expect(recent).toEqual([]);
  });

  it('should return unique recent prompts', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [],
      settings: DEFAULT_SETTINGS,
      usageHistory: [
        { promptId: 'p1', usedAt: 5000 },
        { promptId: 'p2', usedAt: 4000 },
        { promptId: 'p1', usedAt: 3000 },
        { promptId: 'p3', usedAt: 2000 },
      ],
    };

    const recent = await getRecentPrompts();
    expect(recent).toHaveLength(3);
    expect(recent[0].promptId).toBe('p1');
    expect(recent[1].promptId).toBe('p2');
    expect(recent[2].promptId).toBe('p3');
  });

  it('should respect the limit parameter', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [],
      settings: DEFAULT_SETTINGS,
      usageHistory: [
        { promptId: 'p1', usedAt: 5000 },
        { promptId: 'p2', usedAt: 4000 },
        { promptId: 'p3', usedAt: 3000 },
        { promptId: 'p4', usedAt: 2000 },
      ],
    };

    const recent = await getRecentPrompts(2);
    expect(recent).toHaveLength(2);
  });
});

describe('clearUsageHistory', () => {
  beforeEach(clearMockStorage);

  it('should clear all usage history', async () => {
    mockStorage['promptflow-data'] = {
      prompts: [],
      settings: DEFAULT_SETTINGS,
      usageHistory: [
        { promptId: 'p1', usedAt: 1000 },
        { promptId: 'p2', usedAt: 2000 },
      ],
    };

    await clearUsageHistory();

    const history = await getUsageHistory();
    expect(history).toEqual([]);
  });
});
