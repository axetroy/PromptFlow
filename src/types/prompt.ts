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

export interface PromptSettings {
  trigger: string;
  insertMode: 'replace' | 'append';
}

export interface StorageData {
  prompts: Prompt[];
  settings: PromptSettings;
}

export const DEFAULT_SETTINGS: PromptSettings = {
  trigger: '/prompts',
  insertMode: 'replace',
};

// Re-export DEFAULT_PROMPTS from prompts module
export { DEFAULT_PROMPTS } from '../prompts';
