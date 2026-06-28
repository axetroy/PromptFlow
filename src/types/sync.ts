// Types for synced prompts from GitHub repositories

export interface SyncedPrompt {
  id: string;
  repoId: string; // Links to SyncedRepo
  title: string;
  content: string;
  description?: string;
  tags: string[];
  filePath: string; // Path in the repo, e.g., ".agents/prompts/1-code-review.md"
  createdAt: number;
  updatedAt: number;
  enabled?: boolean;
  isSynced?: boolean; // Mark as synced prompt (read-only)
}

export interface SyncedRepo {
  id: string;
  repo: string; // e.g., "owner/repo"
  branch: string;
  promptsPath: string; // e.g., ".agents/prompts"
  lastSyncedAt?: number;
  enabled: boolean;
  enabledPromptIds: string[]; // IDs of enabled prompts within this repo
}

export interface SyncedPromptsData {
  repos: SyncedRepo[];
  prompts: SyncedPrompt[];
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content?: string; // Base64 encoded for files
  encoding?: string;
  type: 'file' | 'dir';
  download_url?: string;
}

/**
 * Fetch file content from GitHub raw content
 */
export async function fetchGitHubFileContent(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Fetch directory listing from GitHub API
 */
export async function fetchGitHubDirectory(
  repo: string,
  path: string,
  branch: string = 'main'
): Promise<GitHubContent[]> {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
    },
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return []; // Path doesn't exist
    }
    throw new Error(`Failed to fetch directory: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Parse YAML frontmatter from markdown content (same as prompts/index.ts)
 */
export function parseFrontmatter(content: string): { metadata: Record<string, any>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { metadata: {}, body: content };
  }
  
  const yamlContent = match[1];
  const body = match[2];
  const metadata: Record<string, any> = {};
  
  const lines = yamlContent.split('\n');
  let currentKey: string | null = null;
  let inArray = false;
  let arrayValues: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('- ')) {
      if (!inArray) {
        inArray = true;
        arrayValues = [];
      }
      arrayValues.push(trimmedLine.substring(2).trim());
      continue;
    }
    
    if (inArray && currentKey) {
      metadata[currentKey] = arrayValues;
      inArray = false;
      arrayValues = [];
    }
    
    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex > 0) {
      if (inArray && currentKey) {
        metadata[currentKey] = arrayValues;
        inArray = false;
        arrayValues = [];
      }
      currentKey = trimmedLine.substring(0, colonIndex).trim();
      const value = trimmedLine.substring(colonIndex + 1).trim();
      if (value) {
        metadata[currentKey] = value;
      }
    }
  }
  
  if (inArray && currentKey) {
    metadata[currentKey] = arrayValues;
  }
  
  return { metadata, body: body.trim() };
}