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
  branch: string; // Original branch name (for display only)
  lastCommit: string; // Actual commit hash from jsdelivr
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
 * Format: https://cdn.jsdelivr.net/gh/{owner}/{repo}@{commit}/{path}
 */
export async function fetchGitHubFileContent(repo: string, filePath: string, commit: string): Promise<string> {
  const url = `https://cdn.jsdelivr.net/gh/${repo}@${commit}/${filePath}`;
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
 * Get the latest commit hash from jsdelivr package page
 */
async function getLatestCommitHash(repo: string): Promise<string> {
  const url = `https://www.jsdelivr.com/package/gh/${repo}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch package page: ${response.statusText}`);
  }
  
  const html = await response.text();
  
  // Parse commit hash from HTML
  // Pattern: <span title="hash">Version <span>hash</span></span>
  const match = html.match(/<span[^>]*title="([a-f0-9]{40})"[^>]*>[\s\S]*?Version[\s\S]*?<span>([a-f0-9]{40})<\/span>/);
  
  if (match) {
    // Try the title attribute first, then the inner span
    return match[1] || match[2];
  }
  
  // Alternative pattern: look for the hash in title attribute
  const titleMatch = html.match(/title="([a-f0-9]{40})"[^>]*>Version/);
  if (titleMatch) {
    return titleMatch[1];
  }
  
  // Try to find any 40-character hex string that looks like a commit hash
  const hashMatch = html.match(/>([a-f0-9]{40})</);
  if (hashMatch) {
    return hashMatch[1];
  }
  
  throw new Error('Could not find commit hash in package page');
}

/**
 * Fetch directory structure from data.jsdelivr.com API
 */
interface JSDelivrFile {
  type: 'file' | 'directory';
  name: string;
  hash?: string;
  size?: number;
  files?: JSDelivrFile[];
}

interface JSDelivrResponse {
  type: string;
  name: string;
  version: string;
  default: string | null;
  files: JSDelivrFile[];
  links: Record<string, string>;
}

async function fetchDirectoryStructure(
  repo: string,
  commit: string,
  path?: string
): Promise<JSDelivrFile[]> {
  const url = path
    ? `https://data.jsdelivr.com/v1/packages/gh/${repo}@${commit}/!${path}`
    : `https://data.jsdelivr.com/v1/packages/gh/${repo}@${commit}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Failed to fetch directory structure: ${response.statusText}`);
  }
  
  const data: JSDelivrResponse = await response.json();
  return data.files || [];
}

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(files: JSDelivrFile[], basePath: string = ''): GitHubContent[] {
  const result: GitHubContent[] = [];
  
  for (const file of files) {
    const filePath = basePath ? `${basePath}/${file.name}` : file.name;
    
    if (file.type === 'file' && file.name.endsWith('.md')) {
      result.push({
        name: file.name,
        path: filePath,
        sha: file.hash || '',
        size: file.size || 0,
        type: 'file',
        download_url: '', // Will be set later
      });
    } else if (file.type === 'directory' && file.files) {
      result.push(...findMarkdownFiles(file.files, filePath));
    }
  }
  
  return result;
}

/**
 * Fetch directory listing from jsdelivr
 * Uses package page to get commit hash, then data API to get file list
 */
export async function fetchGitHubDirectory(
  repo: string,
  path: string
): Promise<{ files: GitHubContent[]; commit: string }> {
  try {
    // Step 1: Get latest commit hash from package page
    const commit = await getLatestCommitHash(repo);
    
    // Step 2: Fetch directory structure from data API
    const files = await fetchDirectoryStructure(repo, commit, path);
    
    if (files.length === 0) {
      return { files: [], commit };
    }
    
    // Step 3: Find all markdown files recursively
    const mdFiles = findMarkdownFiles(files);
    
    // Step 4: Set download URLs
    const filesWithUrls = mdFiles.map(file => ({
      ...file,
      download_url: `https://cdn.jsdelivr.net/gh/${repo}@${commit}/${file.path}`,
    }));
    
    return { files: filesWithUrls, commit };
  } catch (error) {
    console.error('Error fetching GitHub directory:', error);
    return { files: [], commit: '' };
  }
}

/**
 * Check if a repository exists and is accessible
 */
export async function checkRepoExists(repo: string): Promise<{ exists: boolean; error?: string }> {
  try {
    await getLatestCommitHash(repo);
    return { exists: true };
  } catch (error) {
    return { exists: false, error: (error as Error).message };
  }
}

/**
 * Check if a path exists in a repository
 */
export async function checkPathExists(repo: string, path: string): Promise<{ exists: boolean; error?: string }> {
  try {
    const commit = await getLatestCommitHash(repo);
    const files = await fetchDirectoryStructure(repo, commit, path);
    
    if (files.length === 0) {
      // Check if it's a file instead of a directory
      const allFiles = await fetchDirectoryStructure(repo, commit);
      const flatFiles = findMarkdownFiles(allFiles);
      const fileExists = flatFiles.some(f => f.path === path);
      
      if (fileExists) {
        return { exists: true };
      }
      return { exists: false, error: 'Path not found' };
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