import { StorageData, Prompt, PromptSettings, PromptUsage, DEFAULT_SETTINGS, DEFAULT_PROMPTS, MAX_USAGE_HISTORY } from '../types';
import { SyncedPrompt } from '../types/sync';
import { extractRecentPromptIds } from './prompt-helpers';

const STORAGE_KEY = 'promptflow-data';

// Legacy data (saved before the title→name rename) may use `title` instead of `name`.
type LegacyPrompt = Omit<Prompt, 'name'> & { name?: string; title?: string };

function normalizePrompt(prompt: LegacyPrompt): Prompt {
  if (prompt.name) return prompt as Prompt;
  return { ...prompt, name: prompt.title || '' };
}

type LegacySyncedPrompt = Omit<SyncedPrompt, 'name'> & { name?: string; title?: string };

function normalizeSyncedPrompt(prompt: LegacySyncedPrompt): SyncedPrompt {
  if (prompt.name) return prompt as SyncedPrompt;
  return { ...prompt, name: prompt.title || '' };
}

export async function getStorageData(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const data = result[STORAGE_KEY] as (StorageData & { customPrompts?: Prompt[]; disabledDefaultIds?: string[] }) | undefined;
      if (data) {
        resolve({
          prompts: (data.customPrompts || data.prompts || []).map(normalizePrompt),
          settings: data.settings || DEFAULT_SETTINGS,
          usageHistory: data.usageHistory || [],
          disabledDefaultIds: data.disabledDefaultIds || [],
          syncedRepos: data.syncedRepos || [],
          syncedPrompts: (data.syncedPrompts || []).map(normalizeSyncedPrompt),
        });
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
  const raw = await new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve((result[STORAGE_KEY] as Record<string, unknown>) || {});
    });
  });
  const merged = { ...raw, ...data };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: merged }, resolve);
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
  if (prompts.some(p => p.id === prompt.id)) {
    prompt = { ...prompt, id: `custom-${crypto.randomUUID()}` };
  }
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

export async function getRecentPrompts(limit: number = 5): Promise<PromptUsage[]> {
  const history = await getUsageHistory();
  const recentIds = extractRecentPromptIds(history, limit);
  // Map IDs back to full usage records (first occurrence = most recent)
  const idToUsage = new Map<string, PromptUsage>();
  for (const usage of history) {
    if (!idToUsage.has(usage.promptId)) {
      idToUsage.set(usage.promptId, usage);
    }
  }
  return recentIds.map(id => idToUsage.get(id)!);
}

export async function clearUsageHistory(): Promise<void> {
  const data = await getStorageData();
  data.usageHistory = [];
  await saveStorageData(data);
}
