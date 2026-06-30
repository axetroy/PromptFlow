import { StorageData, Prompt, PromptSettings, DEFAULT_SETTINGS, DEFAULT_PROMPTS } from './types';
import { SYNC_INTERVALS, SyncIntervalKey, syncAllEnabledRepos, getSyncStatus as getSyncStatusFromUtils } from './utils/sync';

const STORAGE_KEY = 'promptflow-data';

interface BackgroundMessage<T = unknown> {
  type: string;
  payload?: T;
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
      const result = await syncAllEnabledRepos();
      if (result.syncedCount > 0 || result.errors.length > 0) {
        notifyAllTabs('SYNC_COMPLETE', result);
      }
    } catch (error) {
      console.error('[PromptFlow] Auto-sync failed:', error);
    }
  }
});

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
chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message: BackgroundMessage): Promise<unknown> {
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
      return await syncAllEnabledRepos();

    case 'GET_SYNC_STATUS':
      return await getSyncStatusWithNextSync();

    default:
      console.warn('[PromptFlow] Unknown message type:', type);
      return null;
  }
}

// Get sync status with next sync time from alarm
async function getSyncStatusWithNextSync() {
  const status = await getSyncStatusFromUtils();
  const alarm = await chrome.alarms.get('auto-sync');
  return {
    ...status,
    nextSync: alarm?.scheduledTime ? alarm.scheduledTime : null,
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

async function notifyAllTabs<T>(type: string, payload: T): Promise<void> {
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
