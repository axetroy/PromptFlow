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
 * Fetch file content using jsdelivr CDN
 * Works globally including China, no rate limits
 * Format: https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}
 */
export async function fetchGitHubFileContent(repo: string, filePath: string, branch: string = 'main'): Promise<string> {
  const url = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${filePath}`;
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
 * Fetch directory listing from jsdelivr CDN page
 * Format: https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}/
 * Works globally including China
 */
export async function fetchGitHubDirectory(
  repo: string,
  path: string,
  branch: string = 'main'
): Promise<GitHubContent[]> {
  // jsdelivr CDN directory listing URL (note the trailing slash)
  const url = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${path}/`;
  
  try {
    const response = await fetch(url);
    
    // 404 means the path doesn't exist
    if (response.status === 404) {
      return [];
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch directory: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Check if it's a 404 page (jsdelivr returns 404 page for non-existent paths)
    if (html.includes('Page not found') || html.includes('404')) {
      return [];
    }
    
    const files: GitHubContent[] = [];
    
    // Parse file links from the HTML
    // Pattern: <a rel="nofollow" href="/gh/{owner}/{repo}@{branch}/{filePath}">{fileName}</a>
    // or: <a href="../">...</a> for parent directory
    const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkPattern.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].trim();
      
      // Skip parent directory links (..) and non-md files
      if (href.includes('..') || !text.endsWith('.md')) {
        continue;
      }
      
      // Extract file path from href (remove the /gh/{owner}/{repo}@{branch}/ prefix)
      // href format: /gh/owner/repo@branch/path/to/file.md
      const ghMatch = href.match(/^\/gh\/[^/]+\/[^@]+@[^/]+\/(.+)$/);
      if (!ghMatch) {
        continue;
      }
      
      const filePath = ghMatch[1];
      const fileName = text;
      
      // Avoid duplicates
      if (!files.some(f => f.path === filePath)) {
        files.push({
          name: fileName,
          path: filePath,
          sha: '',
          size: 0,
          type: 'file',
          download_url: `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${filePath}`,
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
    // Try to fetch the root of the repo
    const url = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/`;
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
    const url = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${path}/`;
    const response = await fetch(url);
    
    if (response.ok) {
      return { exists: true };
    }
    
    if (response.status === 404) {
      return { exists: false, error: 'Path not found' };
    }
    
    return { exists: false, error: `HTTP ${response.status}` };
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