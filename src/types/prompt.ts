export interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  enabled?: boolean;
  isDefault?: boolean;
  isReadOnly?: boolean;
}

export interface PromptUsage {
  promptId: string;
  usedAt: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface PromptSettings {
  trigger: string;
  insertMode: 'replace' | 'append';
  syncInterval?: '15min' | '30min' | '1hour' | '2hours' | '1day';
  theme?: ThemeMode;
}

export interface StorageData {
  prompts: Prompt[];
  settings: PromptSettings;
  usageHistory?: PromptUsage[];
  disabledDefaultIds?: string[];
  syncedRepos?: import('./sync').SyncedRepo[];
  syncedPrompts?: import('./sync').SyncedPrompt[];
}

export const DEFAULT_SETTINGS: PromptSettings = {
  trigger: '/prompts',
  insertMode: 'replace',
  syncInterval: '1hour',
  theme: 'system',
};

export const MAX_USAGE_HISTORY = 100;

// Re-export DEFAULT_PROMPTS from prompts module
export { DEFAULT_PROMPTS } from '../prompts';
