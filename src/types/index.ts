export interface Prompt {
    id: string;
    title: string;
    content: string;
    description?: string;
    tags: string[];
    createdAt: number;
    updatedAt: number;
}

export interface Settings {
    trigger: string;
    theme: 'light' | 'dark';
}

export interface StorageData {
    prompts: Prompt[];
    settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
    trigger: '/prompts',
    theme: 'dark',
};

export const DEFAULT_PROMPTS: Prompt[] = [
    {
        id: '1',
        title: 'Code Review',
        content: 'Please review the following code and suggest improvements:\n\n```\n[paste code here]\n```',
        description: 'Review code and suggest improvements',
        tags: ['dev', 'review'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: '2',
        title: 'Explain Code',
        content: 'Please explain what the following code does:\n\n```\n[paste code here]\n```',
        description: 'Explain code functionality',
        tags: ['dev', 'explain'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
];

export type MessageType =
    | 'GET_PROMPTS'
    | 'GET_SETTINGS'
    | 'ADD_PROMPT'
    | 'UPDATE_PROMPT'
    | 'DELETE_PROMPT'
    | 'SAVE_SETTINGS'
    | 'GET_STORAGE_DATA'
    | 'UPDATE_PROMPTS'
    | 'UPDATE_SETTINGS';

export interface Message {
    type: MessageType;
    payload?: unknown;
}

export interface PromptPayload {
    id?: string;
    title: string;
    content: string;
    description?: string;
    tags?: string[];
}

export interface UpdatePayload {
    id: string;
    updates: Partial<Prompt>;
}

export interface SettingsPayload {
    settings: Settings;
}