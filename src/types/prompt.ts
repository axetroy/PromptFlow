export interface Prompt {
  id: string;
  title: string;
  content: string;
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean; // Default prompts cannot be modified/deleted
}

export interface PromptSettings {
  trigger: string;
  theme: 'light' | 'dark' | 'auto';
  insertMode: 'replace' | 'append';
}

export interface StorageData {
  prompts: Prompt[];
  settings: PromptSettings;
}

export const DEFAULT_SETTINGS: PromptSettings = {
  trigger: '/prompts',
  theme: 'auto',
  insertMode: 'replace',
};

export const DEFAULT_PROMPTS: Prompt[] = [
  {
    id: '1',
    title: 'Code Review',
    content: 'Please review the following code and suggest improvements:\n\n```\n{code}\n```\n\nFocus on:\n- Code quality\n- Performance\n- Security',
    description: 'Review code and provide improvement suggestions',
    tags: ['dev', 'review', 'code'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
  {
    id: '2',
    title: 'Explain Code',
    content: 'Explain the following code in detail:\n\n```\n{code}\n```\n\nPlease include:\n- What the code does\n- How it works\n- Key components',
    description: 'Get detailed explanation of any code',
    tags: ['dev', 'explanation', 'learning'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
  {
    id: '3',
    title: 'Bug Fix',
    content: 'I have a bug in the following code:\n\n```\n{code}\n```\n\nError message:\n{error}\n\nPlease help me identify and fix the issue.',
    description: 'Debug and fix code issues',
    tags: ['dev', 'debug', 'fix'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
  {
    id: '4',
    title: 'Write Tests',
    content: 'Write comprehensive tests for the following code:\n\n```\n{code}\n```\n\nRequirements:\n- Cover edge cases\n- Use best practices\n- Include comments',
    description: 'Generate test cases for code',
    tags: ['dev', 'testing', 'quality'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
  {
    id: '5',
    title: 'Refactor Code',
    content: 'Refactor the following code to improve readability and maintainability:\n\n```\n{code}\n```\n\nGoals:\n- Cleaner architecture\n- Better naming\n- Reduced complexity',
    description: 'Improve code structure and quality',
    tags: ['dev', 'refactor', 'cleanup'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
];
