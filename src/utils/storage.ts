import { StorageData, Prompt, PromptSettings, DEFAULT_SETTINGS, DEFAULT_PROMPTS } from '../types';

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
