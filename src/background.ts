import { DEFAULT_SETTINGS, DEFAULT_PROMPTS, type Message, type Prompt, type PromptPayload, type Settings, type UpdatePayload } from './types';

const STORAGE_KEY = 'promptflow-data';

async function initializeStorage(): Promise<void> {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    if (!result[STORAGE_KEY]) {
        const defaultData = {
            prompts: DEFAULT_PROMPTS,
            settings: DEFAULT_SETTINGS,
        };
        await chrome.storage.local.set({ [STORAGE_KEY]: defaultData });
        console.log('[PromptFlow] Initialized with default prompts');
    }
}

async function getStorageData(): Promise<{ prompts: Prompt[]; settings: Settings }> {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const data = result[STORAGE_KEY];
    return data || { prompts: [], settings: DEFAULT_SETTINGS };
}

async function getPrompts(): Promise<Prompt[]> {
    const data = await getStorageData();
    return data.prompts;
}

async function getSettings(): Promise<Settings> {
    const data = await getStorageData();
    return data.settings;
}

async function addPrompt(prompt: PromptPayload): Promise<Prompt[]> {
    const data = await getStorageData();
    const newPrompt: Prompt = {
        id: prompt.id || crypto.randomUUID(),
        title: prompt.title,
        content: prompt.content,
        description: prompt.description || '',
        tags: prompt.tags || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    data.prompts.push(newPrompt);
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
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
        notifyAllTabs('UPDATE_PROMPTS', data.prompts);
    }
    return data.prompts;
}

async function deletePrompt(id: string): Promise<Prompt[]> {
    const data = await getStorageData();
    data.prompts = data.prompts.filter(p => p.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    notifyAllTabs('UPDATE_PROMPTS', data.prompts);
    return data.prompts;
}

async function saveSettings(settings: Settings): Promise<void> {
    const data = await getStorageData();
    data.settings = settings;
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    notifyAllTabs('UPDATE_SETTINGS', settings);
}

async function notifyAllTabs(type: string, payload: unknown): Promise<void> {
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
        if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type, payload }).catch(() => {
                // Tab might not have content script loaded
            });
        }
    });
}

async function handleMessage(message: Message): Promise<unknown> {
    const { type, payload } = message;
    switch (type) {
        case 'GET_PROMPTS':
            return await getPrompts();
        case 'GET_SETTINGS':
            return await getSettings();
        case 'ADD_PROMPT':
            return await addPrompt(payload as PromptPayload);
        case 'UPDATE_PROMPT':
            return await updatePrompt((payload as UpdatePayload).id, (payload as UpdatePayload).updates);
        case 'DELETE_PROMPT':
            return await deletePrompt((payload as { id: string }).id);
        case 'SAVE_SETTINGS':
            return await saveSettings((payload as { settings: Settings }).settings);
        case 'GET_STORAGE_DATA':
            return await getStorageData();
        default:
            console.warn('[PromptFlow] Unknown message type:', type);
            return null;
    }
}

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
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // Keep channel open for async response
});

// Initialize on script load
initializeStorage();