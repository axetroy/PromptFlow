import { StorageData, Prompt, PromptSettings, DEFAULT_SETTINGS, DEFAULT_PROMPTS } from './types';
import { SyncedRepo, SyncedPrompt, fetchGitHubDirectory, fetchGitHubFileContent, parseFrontmatter } from './types/sync';

const STORAGE_KEY = 'promptflow-data';

// Auto-sync interval options (in minutes)
export const SYNC_INTERVALS = {
  '5min': 5,
  '15min': 15,
  '30min': 30,
  '1hour': 60,
} as const;

export type SyncIntervalKey = keyof typeof SYNC_INTERVALS;

interface BackgroundMessage {
  type: string;
  payload?: any;
}

async function initializeStorage(): Promise<void> {
  const result = await chrome.storage.local.get([STORAGE_KEY]);

  if (!result[STORAGE_KEY]) {
    const defaultData: StorageData = {
      prompts: DEFAULT_PROMPTS,
      settings: DEFAULT_SETTINGS,
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: defaultData });
    console.log('[PromptFlow] Initialized with default prompts');
  }
  
  // Initialize auto-sync alarm
  await initializeAutoSync();
}

// Auto-sync functionality using Chrome alarms API
async function initializeAutoSync(): Promise<void> {
  const data = await getStorageData();
  const syncInterval = data.settings.syncInterval || '15min';
  
  // Clear existing alarm
  await chrome.alarms.clear('auto-sync');
  
  // Create new alarm with the configured interval
  const intervalMinutes = SYNC_INTERVALS[syncInterval as SyncIntervalKey] || 15;
  await chrome.alarms.create('auto-sync', {
    delayInMinutes: intervalMinutes,
    periodInMinutes: intervalMinutes,
  });
  
  console.log(`[PromptFlow] Auto-sync initialized with interval: ${syncInterval}`);
}

// Handle auto-sync alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'auto-sync') {
    console.log('[PromptFlow] Auto-sync triggered');
    try {
      await syncAllRepos();
    } catch (error) {
      console.error('[PromptFlow] Auto-sync failed:', error);
    }
  }
});

// Sync all enabled repos
async function syncAllRepos(): Promise<{ synced: number; errors: string[] }> {
  const data = await getStorageData();
  const repos = (data as any).syncedRepos || [];
  const enabledRepos = repos.filter((r: SyncedRepo) => r.enabled);
  
  if (enabledRepos.length === 0) {
    return { synced: 0, errors: [] };
  }
  
  let synced = 0;
  const errors: string[] = [];
  
  for (const repo of enabledRepos) {
    try {
      await syncRepo(repo);
      synced++;
    } catch (error) {
      errors.push(`${repo.repo}: ${(error as Error).message}`);
    }
  }
  
  // Notify all tabs about sync completion
  if (synced > 0) {
    notifyAllTabs('SYNC_COMPLETE', { synced, errors });
  }
  
  return { synced, errors };
}

// Sync a single repo
async function syncRepo(repo: SyncedRepo): Promise<SyncedPrompt[]> {
  console.log(`[PromptFlow] Syncing repo: ${repo.repo}`);
  
  // Fetch directory listing
  const files = await fetchGitHubDirectory(repo.repo, repo.promptsPath, repo.branch);
  
  if (files.length === 0) {
    console.log(`[PromptFlow] No files found in ${repo.repo}/${repo.promptsPath}`);
    return [];
  }
  
  const syncedPrompts: SyncedPrompt[] = [];
  
  // Fetch and parse each file
  for (const file of files) {
    try {
      const content = await fetchGitHubFileContent(repo.repo, file.path, repo.branch);
      const { metadata, body } = parseFrontmatter(content);
      
      const prompt: SyncedPrompt = {
        id: `sync-${repo.id}-${Buffer.from(file.path).toString('base64').slice(0, 8)}`,
        repoId: repo.id,
        title: metadata.title || file.name.replace('.md', ''),
        content: body,
        description: metadata.description || '',
        tags: Array.isArray(metadata.tags) ? metadata.tags : (metadata.tag ? [metadata.tag] : []),
        filePath: file.path,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true,
        isSynced: true,
      };
      
      syncedPrompts.push(prompt);
    } catch (error) {
      console.error(`[PromptFlow] Failed to sync ${file.path}:`, error);
    }
  }
  
  // Update storage with synced prompts
  const data = await getStorageData();
  
  // Remove old prompts from this repo
  const existingPrompts = (data as any).syncedPrompts || [];
  const otherPrompts = existingPrompts.filter((p: SyncedPrompt) => p.repoId !== repo.id);
  
  // Add new prompts
  (data as any).syncedPrompts = [...otherPrompts, ...syncedPrompts];
  
  // Update last synced time
  const repoIndex = (data as any).syncedRepos.findIndex((r: SyncedRepo) => r.id === repo.id);
  if (repoIndex !== -1) {
    (data as any).syncedRepos[repoIndex].lastSyncedAt = Date.now();
  }
  
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
  
  console.log(`[PromptFlow] Synced ${syncedPrompts.length} prompts from ${repo.repo}`);
  return syncedPrompts;
}

chrome.action.onClicked.addListener(async () => {
  // Open the settings page when the extension icon is clicked
  await openSettings();
})

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorage();
  console.log('[PromptFlow] Extension installed');
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  await initializeStorage();
  console.log('[PromptFlow] Extension started');
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message: BackgroundMessage, sender: chrome.runtime.MessageSender): Promise<any> {
  const { type, payload } = message;

  switch (type) {
    case 'GET_PROMPTS':
      return await getPrompts();

    case 'GET_SETTINGS':
      return await getSettings();

    case 'ADD_PROMPT':
      return await addPrompt(payload as Prompt);

    case 'UPDATE_PROMPT':
      return await updatePrompt(payload.id, payload.updates);

    case 'DELETE_PROMPT':
      return await deletePrompt(payload.id);

    case 'SAVE_SETTINGS':
      await saveSettings(payload as PromptSettings);
      // Re-initialize auto-sync with new interval
      if (payload.syncInterval) {
        await initializeAutoSync();
      }
      return null;

    case 'GET_STORAGE_DATA':
      return await getStorageData();

    case 'OPEN_SETTINGS':
      return await openSettings();

    case 'SYNC_NOW':
      return await syncAllRepos();

    case 'GET_SYNC_STATUS':
      return await getSyncStatus();

    default:
      console.warn('[PromptFlow] Unknown message type:', type);
      return null;
  }
}

// Get current sync status
async function getSyncStatus(): Promise<{ lastSynced: number | null; nextSync: number | null; enabled: boolean }> {
  const data = await getStorageData();
  const repos = (data as any).syncedRepos || [];
  const enabledRepos = repos.filter((r: SyncedRepo) => r.enabled);
  
  // Get the most recent sync time
  let lastSynced: number | null = null;
  for (const repo of enabledRepos) {
    if (repo.lastSyncedAt && (!lastSynced || repo.lastSyncedAt > lastSynced)) {
      lastSynced = repo.lastSyncedAt;
    }
  }
  
  // Get next sync time from alarm
  const alarm = await chrome.alarms.get('auto-sync');
  const nextSync = alarm?.scheduledTime ? alarm.scheduledTime : null;
  
  return {
    lastSynced,
    nextSync,
    enabled: enabledRepos.length > 0,
  };
}

async function openSettings(): Promise<void> {
  // Try to open the extension's settings page
  // For Chrome extensions, we can try to open the settings page
  const settingsUrl = chrome.runtime.getURL('settings.html');
  
  try {
    // Check if we can open a tab
    const existingTabs = await chrome.tabs.query({ url: settingsUrl });
    
    if (existingTabs.length > 0) {
      // Focus existing settings tab
      await chrome.tabs.update(existingTabs[0].id!, { active: true });
    } else {
      // Open new settings tab
      await chrome.tabs.create({ url: settingsUrl });
    }
  } catch (error) {
    console.error('[PromptFlow] Failed to open settings:', error);
    throw error;
  }
}

async function getStorageData(): Promise<StorageData> {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const data = result[STORAGE_KEY] as StorageData | undefined;
  return data || { prompts: [], settings: DEFAULT_SETTINGS };
}

async function getPrompts(): Promise<Prompt[]> {
  const data = await getStorageData();
  return data.prompts;
}

async function getSettings(): Promise<PromptSettings> {
  const data = await getStorageData();
  return data.settings;
}

async function addPrompt(prompt: Prompt): Promise<Prompt[]> {
  const data = await getStorageData();
  const newPrompt: Prompt = {
    ...prompt,
    id: prompt.id || crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  data.prompts.push(newPrompt);
  await chrome.storage.local.set({ [STORAGE_KEY]: data });

  // Notify all tabs
  notifyAllTabs('UPDATE_PROMPTS', data.prompts);

  return data.prompts;
}

async function updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt[]> {
  const data = await getStorageData();
  const index = data.prompts.findIndex(p => p.id === id);

  if (index !== -1) {
    data.prompts[index] = {
      ...data.prompts[index],
      ...updates,
      updatedAt: Date.now(),
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: data });

    // Notify all tabs
    notifyAllTabs('UPDATE_PROMPTS', data.prompts);
  }

  return data.prompts;
}

async function deletePrompt(id: string): Promise<Prompt[]> {
  const data = await getStorageData();
  data.prompts = data.prompts.filter(p => p.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: data });

  // Notify all tabs
  notifyAllTabs('UPDATE_PROMPTS', data.prompts);

  return data.prompts;
}

async function saveSettings(settings: PromptSettings): Promise<void> {
  const data = await getStorageData();
  data.settings = settings;
  await chrome.storage.local.set({ [STORAGE_KEY]: data });

  // Notify all tabs
  notifyAllTabs('UPDATE_SETTINGS', settings);
}

async function notifyAllTabs(type: string, payload: any): Promise<void> {
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type, payload }).catch(() => {
        // Tab might not have content script loaded
      });
    }
  });
}

// Initialize on script load
initializeStorage();
