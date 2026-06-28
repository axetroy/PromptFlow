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
export async function fetchGitHubFileContent(repo: string, filePath: string, branch: string = 'main'): Promise<string> {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`File not found: ${filePath}`);
    }
    throw new Error(`Failed to fetch file ${filePath}: ${response.statusText}`);
  }
  
  return response.text();
}

/**
 * Fetch directory listing from GitHub web page
 * Scrapes the GitHub tree page to get file list
 */
export async function fetchGitHubDirectory(
  repo: string,
  path: string,
  branch: string = 'main'
): Promise<GitHubContent[]> {
  try {
    // GitHub tree page URL
    const url = `https://github.com/${repo}/tree/${branch}/${path}`;
    const response = await fetch(url);
    
    if (response.status === 404) {
      return [];
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch directory: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Check if it's a 404 page
    if (html.includes('404') && html.includes('Page not found')) {
      return [];
    }
    
    const files: GitHubContent[] = [];
    
    // Parse file links from the HTML
    // Pattern: data-ga-click="File explorer" href="/owner/repo/blob/branch/path/file.md"
    // or: <a class="js-navigation-open" href="/owner/repo/blob/branch/path/file.md" title="file.md">
    
    // Pattern 1: data-ga-click links (file explorer)
    const fileLinkPattern1 = /href="\/[^/]+\/[^/]+\/blob\/[^/]+\/([^"?]+\.md)"/g;
    let match;
    
    while ((match = fileLinkPattern1.exec(html)) !== null) {
      const filePath = match[1];
      const fileName = filePath.split('/').pop() || filePath;
      
      if (!files.some(f => f.path === filePath)) {
        files.push({
          name: fileName,
          path: filePath,
          sha: '',
          size: 0,
          type: 'file',
          download_url: `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`,
        });
      }
    }
    
    // Pattern 2: js-navigation-open links
    const fileLinkPattern2 = /class="js-navigation-open"[^>]+href="\/[^/]+\/[^/]+\/blob\/[^/]+\/([^"?]+\.md)"/g;
    
    while ((match = fileLinkPattern2.exec(html)) !== null) {
      const filePath = match[1];
      const fileName = filePath.split('/').pop() || filePath;
      
      if (!files.some(f => f.path === filePath)) {
        files.push({
          name: fileName,
          path: filePath,
          sha: '',
          size: 0,
          type: 'file',
          download_url: `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`,
        });
      }
    }
    
    return files;
  } catch (error) {
    console.error('Error fetching GitHub directory:', error);
    return [];
  }
}

/**
 * Check if a repository exists and is accessible
 */
export async function checkRepoExists(repo: string, branch: string = 'main'): Promise<{ exists: boolean; error?: string }> {
  try {
    const url = `https://github.com/${repo}/tree/${branch}`;
    const response = await fetch(url);
    
    if (response.ok) {
      return { exists: true };
    }
    
    if (response.status === 404) {
      return { exists: false, error: 'Repository or branch not found' };
    }
    
    return { exists: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return { exists: false, error: (error as Error).message };
  }
}

/**
 * Check if a path exists in a repository
 */
export async function checkPathExists(repo: string, path: string, branch: string = 'main'): Promise<{ exists: boolean; error?: string }> {
  try {
    const files = await fetchGitHubDirectory(repo, path, branch);
    
    if (files.length === 0) {
      // Path might not exist or might be empty
      return { exists: false, error: 'Path not found or empty' };
    }
    
    return { exists: true };
  } catch (error) {
    return { exists: false, error: (error as Error).message };
  }
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