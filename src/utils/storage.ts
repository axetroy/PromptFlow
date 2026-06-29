import { StorageData, Prompt, PromptSettings, PromptUsage, DEFAULT_SETTINGS, DEFAULT_PROMPTS, MAX_USAGE_HISTORY } from '../types';

const STORAGE_KEY = 'promptflow-data';

export async function getStorageData(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const data = result[STORAGE_KEY] as StorageData | undefined;
      if (data?.prompts && data?.settings) {
        resolve(data);
      } else {
        const defaultData: StorageData = {
          prompts: DEFAULT_PROMPTS,
          settings: DEFAULT_SETTINGS,
          usageHistory: [],
        };
        resolve(defaultData);
      }
    });
  });
}

export async function saveStorageData(data: StorageData): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
  });
}

export async function getPrompts(): Promise<Prompt[]> {
  const data = await getStorageData();
  return data.prompts;
}

export async function savePrompts(prompts: Prompt[]): Promise<void> {
  const data = await getStorageData();
  data.prompts = prompts;
  await saveStorageData(data);
}

export async function getSettings(): Promise<PromptSettings> {
  const data = await getStorageData();
  return data.settings;
}

export async function saveSettings(settings: PromptSettings): Promise<void> {
  const data = await getStorageData();
  data.settings = settings;
  await saveStorageData(data);
}

export async function addPrompt(prompt: Prompt): Promise<void> {
  const prompts = await getPrompts();
  prompts.push(prompt);
  await savePrompts(prompts);
}

export async function updatePrompt(id: string, updates: Partial<Prompt>): Promise<void> {
  const prompts = await getPrompts();
  const index = prompts.findIndex((p) => p.id === id);
  if (index !== -1) {
    prompts[index] = { ...prompts[index], ...updates, updatedAt: Date.now() };
    await savePrompts(prompts);
  }
}

export async function deletePrompt(id: string): Promise<void> {
  const prompts = await getPrompts();
  const filtered = prompts.filter((p) => p.id !== id);
  await savePrompts(filtered);
}

// Usage tracking functions
export async function getUsageHistory(): Promise<PromptUsage[]> {
  const data = await getStorageData();
  return data.usageHistory || [];
}

export async function recordPromptUsage(promptId: string): Promise<void> {
  const data = await getStorageData();
  
  // Initialize usageHistory if not exists
  if (!data.usageHistory) {
    data.usageHistory = [];
  }
  
  // Add new usage record at the beginning (no deduplication - we want to track total usage count)
  const newUsage: PromptUsage = {
    promptId,
    usedAt: Date.now(),
  };
  
  // Add the new usage at the beginning
  data.usageHistory.unshift(newUsage);
  
  // Trim to max history size
  if (data.usageHistory.length > MAX_USAGE_HISTORY) {
    data.usageHistory = data.usageHistory.slice(0, MAX_USAGE_HISTORY);
  }
  
  await saveStorageData(data);
}

export async function getUsageStats(): Promise<Map<string, number>> {
  const history = await getUsageHistory();
  const stats = new Map<string, number>();
  
  for (const usage of history) {
    stats.set(usage.promptId, (stats.get(usage.promptId) || 0) + 1);
  }
  
  return stats;
}

export async function getRecentPrompts(limit: number = 5): Promise<PromptUsage[]> {
  const history = await getUsageHistory();
  // Return unique prompts by most recent usage
  const seen = new Set<string>();
  const recent: PromptUsage[] = [];
  
  for (const usage of history) {
    if (!seen.has(usage.promptId)) {
      seen.add(usage.promptId);
      recent.push(usage);
      if (recent.length >= limit) break;
    }
  }
  
  return recent;
}

export async function clearUsageHistory(): Promise<void> {
  const data = await getStorageData();
  data.usageHistory = [];
  await saveStorageData(data);
}
