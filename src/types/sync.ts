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
 * Fetch file content from raw.githubusercontent.com (no rate limit for public repos)
 */
export async function fetchGitHubFileContent(repo: string, filePath: string, branch: string = 'main'): Promise<string> {
  // Use raw.githubusercontent.com which is a CDN and has no rate limits
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file ${filePath}: ${response.statusText}`);
  }
  
  return response.text();
}

/**
 * Fetch directory listing by scraping GitHub's tree page (no API rate limits)
 * This avoids the GitHub API rate limit issue for public repositories
 */
export async function fetchGitHubDirectory(
  repo: string,
  path: string,
  branch: string = 'main'
): Promise<GitHubContent[]> {
  // Use GitHub's web interface to get directory listing
  const url = `https://github.com/${repo}/tree/${branch}/${path}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return []; // Path doesn't exist
      }
      throw new Error(`Failed to fetch directory: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Parse the HTML to extract file information
    // GitHub uses React to render, but the initial HTML contains file data in a script tag
    const files: GitHubContent[] = [];
    
    // Try to extract from the react-router data embedded in the page
    const dataMatch = html.match(/<script type="application\/json" data-target="react-app\.embeddedData">([\s\S]*?)<\/script>/);
    if (dataMatch) {
      try {
        const jsonData = JSON.parse(dataMatch[1]);
        const treeItems = jsonData?.payload?.tree?.items || jsonData?.payload?.tree || [];
        
        for (const item of treeItems) {
          if (item.type === 'blob' && item.path.endsWith('.md')) {
            files.push({
              name: item.name || item.path.split('/').pop(),
              path: item.path,
              sha: item.oid || '',
              size: item.size || 0,
              type: 'file',
              download_url: `https://raw.githubusercontent.com/${repo}/${branch}/${item.path}`,
            });
          }
        }
        
        return files;
      } catch (e) {
        console.warn('Failed to parse embedded JSON, trying alternative method');
      }
    }
    
    // Fallback: Parse HTML directly using regex patterns
    // Look for file entries in the tree view
    const fileLinkPattern = /href="\/[^/]+\/[^/]+\/blob\/[^/]+\/([^"]+\.md)"/g;
    let match;
    
    while ((match = fileLinkPattern.exec(html)) !== null) {
      const filePath = match[1];
      const fileName = filePath.split('/').pop() || '';
      
      // Avoid duplicates
      if (!files.some(f => f.path === filePath)) {
        files.push({
          name: fileName,
          path: filePath,
          sha: '', // Not available from HTML
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
 * Alternative: Fetch directory listing using GitHub API with error handling
 * Falls back gracefully on rate limit
 */
export async function fetchGitHubDirectoryWithFallback(
  repo: string,
  path: string,
  branch: string = 'main'
): Promise<GitHubContent[]> {
  // Try web scraping first (no rate limit)
  const webResults = await fetchGitHubDirectory(repo, path, branch);
  if (webResults.length > 0) {
    return webResults;
  }
  
  // Fallback to API (may be rate limited)
  try {
    const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        console.warn('GitHub API rate limit exceeded. Please try again later or add a GitHub token.');
      }
      return [];
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return [];
    }
    
    return data
      .filter((item: any) => item.type === 'file' && item.name.endsWith('.md'))
      .map((item: any) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        size: item.size,
        type: item.type,
        download_url: item.download_url,
      }));
  } catch (error) {
    console.error('Error fetching via API:', error);
    return [];
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