export interface Prompt {
  id: string;
  title: string;
  content: string;
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  enabled?: boolean;
}

export interface PromptUsage {
  promptId: string;
  usedAt: number;
}

export interface PromptSettings {
  trigger: string;
  insertMode: 'replace' | 'append';
}

export interface StorageData {
  prompts: Prompt[];
  settings: PromptSettings;
  usageHistory?: PromptUsage[];
}

export const DEFAULT_SETTINGS: PromptSettings = {
  trigger: '/prompts',
  insertMode: 'replace',
};

export const MAX_USAGE_HISTORY = 100;

// Re-export DEFAULT_PROMPTS from prompts module
export { DEFAULT_PROMPTS } from '../prompts';
